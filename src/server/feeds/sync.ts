import "server-only";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

/**
 * REAL data-feed sync (server/cron side). Mirrors scripts/sync-feed.mjs so it can run automatically on
 * Vercel Cron. ESPN's public scoreboard (no key) supplies the events + any odds ESPN publishes; if
 * THE_ODDS_API_KEY is set we additionally pull The Odds API and let its bookmaker consensus override
 * the win probabilities. Writes/upserts live prediction slates in the canonical shape.
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

interface FeedEvent {
  id: string;
  title: string;
  category: string;
  lockMs: number;
  homeName: string;
  awayName: string;
  probHome: number;
  probAway: number;
  total: number | null;
  source: "espn" | "oddsapi";
}

function mlToImplied(ml: number | null | undefined): number | null {
  if (ml == null || Number.isNaN(Number(ml))) return null;
  const n = Number(ml);
  return n < 0 ? -n / (-n + 100) : 100 / (n + 100);
}
function normalizePair(iHome: number | null, iAway: number | null): { home: number; away: number } | null {
  if (iHome == null || iAway == null || iHome + iAway <= 0) return null;
  const home = Math.min(99, Math.max(1, Math.round((100 * iHome) / (iHome + iAway))));
  return { home, away: 100 - home };
}
const norm = (s: string | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fetchESPN(l: (typeof LEAGUES)[number], now: number): Promise<FeedEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`;
  const res = await fetch(url, { cache: "no-store" });
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
    const home = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "home");
    const away = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    const o = comp.odds?.[0];
    const pair = normalizePair(mlToImplied(o?.homeTeamOdds?.moneyLine), mlToImplied(o?.awayTeamOdds?.moneyLine));
    out.push({
      id: `espn-${l.league}-${ev.id}`,
      title: `${away.team.displayName} @ ${home.team.displayName}`,
      category: l.category,
      lockMs: start,
      homeName: home.team.displayName,
      awayName: away.team.displayName,
      probHome: pair?.home ?? 50,
      probAway: pair?.away ?? 50,
      total: typeof o?.overUnder === "number" ? o.overUnder : null,
      source: "espn",
    });
  }
  return out;
}

async function enrichWithOddsAPI(l: (typeof LEAGUES)[number], events: FeedEvent[]): Promise<void> {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key || events.length === 0) return;
  const url = `https://api.the-odds-api.com/v4/sports/${l.oddsKey}/odds/?apiKey=${key}&regions=us&markets=h2h,totals&oddsFormat=american`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[feed] OddsAPI ${l.oddsKey}: HTTP ${res.status}`);
    return;
  }
  const games = await res.json();
  for (const ev of events) {
    const g = games.find((x: { home_team: string; away_team: string }) => {
      const h = norm(x.home_team), a = norm(x.away_team), eh = norm(ev.homeName), ea = norm(ev.awayName);
      return (eh.includes(h) || h.includes(eh)) && (ea.includes(a) || a.includes(ea));
    });
    if (!g) continue;
    const bk = g.bookmakers?.[0];
    const h2h = bk?.markets?.find((m: { key: string }) => m.key === "h2h");
    const mlH = h2h?.outcomes?.find((o: { name: string }) => norm(o.name) === norm(g.home_team))?.price;
    const mlA = h2h?.outcomes?.find((o: { name: string }) => norm(o.name) === norm(g.away_team))?.price;
    const pair = normalizePair(mlToImplied(mlH), mlToImplied(mlA));
    if (pair) {
      ev.probHome = pair.home;
      ev.probAway = pair.away;
      ev.source = "oddsapi";
    }
    const totals = bk?.markets?.find((m: { key: string }) => m.key === "totals");
    const pt = totals?.outcomes?.[0]?.point;
    if (typeof pt === "number") ev.total = pt;
  }
}

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
  const preds: Array<{ id: string; question: string; optionA: string; optionB: string; optionAProbability: number; optionBProbability: number; predictionType: string; overUnderLine: number | null }> = [
    { id: "p1", question: "Who wins?", optionA: ev.homeName, optionB: ev.awayName, optionAProbability: ev.probHome, optionBProbability: ev.probAway, predictionType: "binary", overUnderLine: null },
  ];
  if (ev.total != null) {
    preds.push({ id: "p2", question: "Total", optionA: `Over ${ev.total}`, optionB: `Under ${ev.total}`, optionAProbability: 50, optionBProbability: 50, predictionType: "over_under", overUnderLine: ev.total });
  }
  let sortOrder = 0;
  for (const p of preds) {
    await ref.collection(COLLECTIONS.predictions).doc(p.id).set(
      {
        question: p.question,
        optionA: p.optionA,
        optionB: p.optionB,
        optionAProbability: p.optionAProbability,
        optionBProbability: p.optionBProbability,
        optionAMultiplier: Math.round((100 / Math.max(1, p.optionAProbability)) * 100) / 100,
        optionBMultiplier: Math.round((100 / Math.max(1, p.optionBProbability)) * 100) / 100,
        predictionType: p.predictionType,
        overUnderLine: p.overUnderLine,
        result: null,
        verificationSources: null,
        verificationConfidence: null,
        sortOrder: sortOrder++,
      },
      { merge: true },
    );
  }
}

/** Pull upcoming games across the configured leagues and upsert them as live slates. */
export async function syncFeed(now: number = Date.now()): Promise<{ synced: number; byLeague: Record<string, number>; oddsApi: boolean }> {
  const byLeague: Record<string, number> = {};
  let synced = 0;
  for (const l of LEAGUES) {
    try {
      const events = (await fetchESPN(l, now)).slice(0, PER_LEAGUE);
      await enrichWithOddsAPI(l, events);
      for (const ev of events) await writeSlate(ev, now);
      byLeague[l.category] = (byLeague[l.category] ?? 0) + events.length;
      synced += events.length;
    } catch (err) {
      console.error(`[feed] ${l.league} failed`, err);
    }
  }
  return { synced, byLeague, oddsApi: !!process.env.THE_ODDS_API_KEY };
}
