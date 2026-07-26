import "server-only";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

/**
 * REAL data-feed sync (server/cron side). Mirrors scripts/sync-feed.mjs. ESPN's public scoreboard
 * (no key) carries DraftKings odds — moneyline, spread (run/puck/point line) and totals — so each game
 * becomes a MULTI-MARKET slate. If THE_ODDS_API_KEY is set, refine the moneyline from The Odds API
 * consensus. Player props (player stats) need The Odds API per-event endpoint (paid) — not yet wired.
 */
const DAY = 24 * 60 * 60 * 1000;
const PER_LEAGUE = 8;
const HORIZON_MS = 10 * DAY;
const tiers = [
  { tier: 5, hostingFeeCents: 100 },
  { tier: 10, hostingFeeCents: 200 },
  { tier: 25, hostingFeeCents: 300 },
];

const LEAGUES = [
  { sport: "baseball", league: "mlb", category: "MLB", oddsKey: "baseball_mlb" },
  { sport: "basketball", league: "wnba", category: "WNBA", oddsKey: "basketball_wnba" },
  { sport: "soccer", league: "usa.1", category: "Soccer", oddsKey: "soccer_usa_mls" },
  { sport: "soccer", league: "eng.1", category: "Soccer", oddsKey: "soccer_epl" },
  { sport: "football", league: "nfl", category: "NFL", oddsKey: "americanfootball_nfl" },
  { sport: "football", league: "college-football", category: "CFB", oddsKey: "americanfootball_ncaaf" },
  { sport: "basketball", league: "nba", category: "NBA", oddsKey: "basketball_nba" },
  { sport: "hockey", league: "nhl", category: "NHL", oddsKey: "icehockey_nhl" },
] as const;

const MKT: Record<string, { spread: string; total: string }> = {
  MLB: { spread: "Run line", total: "Total runs" },
  NHL: { spread: "Puck line", total: "Total goals" },
  NBA: { spread: "Point spread", total: "Total points" },
  WNBA: { spread: "Point spread", total: "Total points" },
  NFL: { spread: "Point spread", total: "Total points" },
  CFB: { spread: "Point spread", total: "Total points" },
  Soccer: { spread: "Goal spread", total: "Total goals" },
};
const labelsFor = (cat: string) => MKT[cat] ?? { spread: "Spread", total: "Total" };

interface Market {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  probA: number;
  probB: number;
  type: "binary" | "over_under";
  line: number | null;
}
interface FeedEvent {
  id: string;
  title: string;
  category: string;
  lockMs: number;
  homeName: string;
  awayName: string;
  source: "espn" | "oddsapi";
  predictions: Market[];
}

function amOdds(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/^\+/, ""));
  return Number.isNaN(n) ? null : n;
}
function mlToImplied(ml: number | null): number | null {
  if (ml == null) return null;
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
}
function pair(iA: number | null, iB: number | null): { a: number; b: number } | null {
  if (iA == null || iB == null || iA + iB <= 0) return null;
  const a = Math.min(99, Math.max(1, Math.round((100 * iA) / (iA + iB))));
  return { a, b: 100 - a };
}
const norm = (s: string | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* eslint-disable @typescript-eslint/no-explicit-any */
function buildPredictions(o: any, homeName: string, awayName: string, cat: string): Market[] {
  const L = labelsFor(cat);
  const preds: Market[] = [];
  const ml = pair(mlToImplied(amOdds(o?.moneyline?.home?.close?.odds)), mlToImplied(amOdds(o?.moneyline?.away?.close?.odds)));
  preds.push({ id: "ml", question: "Who wins?", optionA: homeName, optionB: awayName, probA: ml?.a ?? 50, probB: ml?.b ?? 50, type: "binary", line: null });
  const spH = o?.pointSpread?.home?.close, spA = o?.pointSpread?.away?.close;
  if (spH?.line && spA?.line) {
    const sp = pair(mlToImplied(amOdds(spH.odds)), mlToImplied(amOdds(spA.odds)));
    preds.push({ id: "spread", question: L.spread, optionA: `${homeName} ${spH.line}`, optionB: `${awayName} ${spA.line}`, probA: sp?.a ?? 50, probB: sp?.b ?? 50, type: "binary", line: typeof o?.spread === "number" ? o.spread : null });
  }
  const totLine = typeof o?.overUnder === "number" ? o.overUnder : null;
  if (totLine != null) {
    const tot = pair(mlToImplied(amOdds(o?.total?.over?.close?.odds)), mlToImplied(amOdds(o?.total?.under?.close?.odds)));
    preds.push({ id: "total", question: L.total, optionA: `Over ${totLine}`, optionB: `Under ${totLine}`, probA: tot?.a ?? 50, probB: tot?.b ?? 50, type: "over_under", line: totLine });
  }
  return preds;
}

async function fetchESPN(l: (typeof LEAGUES)[number], now: number): Promise<FeedEvent[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[feed] ESPN ${l.league}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const out: FeedEvent[] = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const start = new Date(ev.date).getTime();
    if (start <= now || start > now + HORIZON_MS) continue;
    const home = comp.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp.competitors?.find((c: any) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    const homeName = home.team.displayName, awayName = away.team.displayName;
    out.push({
      id: `espn-${l.league}-${ev.id}`,
      title: `${awayName} @ ${homeName}`,
      category: l.category,
      lockMs: start,
      homeName,
      awayName,
      source: "espn",
      predictions: buildPredictions(comp.odds?.[0] ?? {}, homeName, awayName, l.category),
    });
  }
  return out;
}

async function enrichWithOddsAPI(l: (typeof LEAGUES)[number], events: FeedEvent[]): Promise<void> {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key || events.length === 0) return;
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/${l.oddsKey}/odds/?apiKey=${key}&regions=us&markets=h2h&oddsFormat=american`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[feed] OddsAPI ${l.oddsKey}: HTTP ${res.status}`);
    return;
  }
  const games = await res.json();
  for (const ev of events) {
    const g = games.find((x: any) => {
      const h = norm(x.home_team), a = norm(x.away_team), eh = norm(ev.homeName), ea = norm(ev.awayName);
      return (eh.includes(h) || h.includes(eh)) && (ea.includes(a) || a.includes(ea));
    });
    if (!g) continue;
    const h2h = g.bookmakers?.[0]?.markets?.find((m: any) => m.key === "h2h");
    const mlp = pair(
      mlToImplied(amOdds(h2h?.outcomes?.find((o: any) => norm(o.name) === norm(g.home_team))?.price)),
      mlToImplied(amOdds(h2h?.outcomes?.find((o: any) => norm(o.name) === norm(g.away_team))?.price)),
    );
    const mlPred = ev.predictions.find((p) => p.id === "ml");
    if (mlp && mlPred) {
      mlPred.probA = mlp.a;
      mlPred.probB = mlp.b;
      ev.source = "oddsapi";
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function writeSlate(ev: FeedEvent, now: number): Promise<void> {
  const ref = adminDb().collection(COLLECTIONS.slates).doc(ev.id);
  await ref.set(
    {
      creatorId: null,
      title: ev.title,
      description: null,
      category: ev.category,
      status: "live",
      entryTiers: tiers,
      entryCount: 0,
      isCardRush: false,
      rushMultiplier: 1,
      maxEntries: null,
      lockTime: Timestamp.fromMillis(ev.lockMs),
      promotionOpensAt: Timestamp.fromMillis(now - DAY),
      settledAt: null,
      cancelledAt: null,
      creatorBonusCents: 0,
      source: ev.source,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  let sortOrder = 0;
  for (const p of ev.predictions) {
    await ref.collection(COLLECTIONS.predictions).doc(p.id).set(
      {
        question: p.question,
        optionA: p.optionA,
        optionB: p.optionB,
        optionAProbability: p.probA,
        optionBProbability: p.probB,
        optionAMultiplier: Math.round((100 / Math.max(1, p.probA)) * 100) / 100,
        optionBMultiplier: Math.round((100 / Math.max(1, p.probB)) * 100) / 100,
        predictionType: p.type,
        overUnderLine: p.line,
        result: null,
        verificationSources: null,
        verificationConfidence: null,
        sortOrder: sortOrder++,
      },
      { merge: true },
    );
  }
  const existing = await ref.collection(COLLECTIONS.predictions).get();
  const keep = new Set(ev.predictions.map((p) => p.id));
  for (const d of existing.docs) if (!keep.has(d.id)) await d.ref.delete();
}

/** Pull upcoming games across the configured leagues and upsert them as multi-market live slates. */
export async function syncFeed(now: number = Date.now()): Promise<{ synced: number; markets: number; byLeague: Record<string, number>; oddsApi: boolean }> {
  const byLeague: Record<string, number> = {};
  let synced = 0, markets = 0;
  for (const l of LEAGUES) {
    try {
      const events = (await fetchESPN(l, now)).slice(0, PER_LEAGUE);
      await enrichWithOddsAPI(l, events);
      for (const ev of events) {
        await writeSlate(ev, now);
        markets += ev.predictions.length;
      }
      byLeague[l.category] = (byLeague[l.category] ?? 0) + events.length;
      synced += events.length;
    } catch (err) {
      console.error(`[feed] ${l.league} failed`, err);
    }
  }
  return { synced, markets, byLeague, oddsApi: !!process.env.THE_ODDS_API_KEY };
}
