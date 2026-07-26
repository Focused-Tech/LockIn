/**
 * REAL data-feed sync — writes live prediction slates into Firestore from real schedules.
 *
 *   node --env-file=.env.local scripts/sync-feed.mjs   (or: npm run sync:feed)
 *
 * Source: ESPN's public scoreboard API (no key, unlimited) carries the events + odds ESPN publishes.
 * If THE_ODDS_API_KEY is set, we ALSO pull The Odds API and let its bookmaker odds override the
 * probabilities (richer/liquid markets). Both are wired; ESPN alone works with zero config.
 *
 * Slate doc shape mirrors scripts/seed-firestore.mjs / src/lib/firebase/types.ts exactly.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) { console.error("Missing FIREBASE_* creds"); process.exit(1); }
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const ODDS_KEY = process.env.THE_ODDS_API_KEY || null;
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const PER_LEAGUE = 8;              // cap slates written per league per run
const HORIZON_MS = 10 * DAY;       // only ingest games starting within 10 days
const tiers = [{ tier: 5, hostingFeeCents: 100 }, { tier: 10, hostingFeeCents: 200 }, { tier: 25, hostingFeeCents: 300 }];

// ESPN sport/league path + display category + The Odds API sport key (for the optional enrichment).
const LEAGUES = [
  { sport: "baseball", league: "mlb", category: "MLB", oddsKey: "baseball_mlb" },
  { sport: "basketball", league: "wnba", category: "WNBA", oddsKey: "basketball_wnba" },
  { sport: "soccer", league: "usa.1", category: "Soccer", oddsKey: "soccer_usa_mls" },
  { sport: "soccer", league: "eng.1", category: "Soccer", oddsKey: "soccer_epl" },
  { sport: "football", league: "nfl", category: "NFL", oddsKey: "americanfootball_nfl" },
  { sport: "football", league: "college-football", category: "CFB", oddsKey: "americanfootball_ncaaf" },
  { sport: "basketball", league: "nba", category: "NBA", oddsKey: "basketball_nba" },
  { sport: "hockey", league: "nhl", category: "NHL", oddsKey: "icehockey_nhl" },
];

/** American moneyline → implied win probability (0..1), vig included. */
function mlToImplied(ml) {
  if (ml == null || Number.isNaN(Number(ml))) return null;
  const n = Number(ml);
  return n < 0 ? -n / (-n + 100) : 100 / (n + 100);
}
/** De-vig a raw home/away implied pair into % that sum to 100 (rounded). */
function normalizePair(iHome, iAway) {
  if (iHome == null || iAway == null || iHome + iAway <= 0) return null;
  const home = Math.round((100 * iHome) / (iHome + iAway));
  return { home: Math.min(99, Math.max(1, home)), away: 100 - Math.min(99, Math.max(1, home)) };
}
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function fetchESPN(l) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`  ESPN ${l.league}: HTTP ${res.status}`); return []; }
  const data = await res.json();
  const out = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const start = new Date(ev.date).getTime();
    if (start <= now || start > now + HORIZON_MS) continue; // future only, within horizon
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    const homeName = home.team.displayName;
    const awayName = away.team.displayName;
    // ESPN sometimes publishes odds inline.
    const o = comp.odds?.[0];
    const pair = normalizePair(mlToImplied(o?.homeTeamOdds?.moneyLine), mlToImplied(o?.awayTeamOdds?.moneyLine));
    const total = typeof o?.overUnder === "number" ? o.overUnder : null;
    out.push({
      id: `espn-${l.league}-${ev.id}`,
      title: `${awayName} @ ${homeName}`,
      category: l.category,
      lockMs: start,
      homeName, awayName,
      probHome: pair?.home ?? 50,
      probAway: pair?.away ?? 50,
      total,
      source: "espn",
    });
  }
  return out;
}

/** Optional: override probabilities/totals from The Odds API bookmaker consensus (key-gated). */
async function enrichWithOddsAPI(l, events) {
  if (!ODDS_KEY || events.length === 0) return events;
  const url = `https://api.the-odds-api.com/v4/sports/${l.oddsKey}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,totals&oddsFormat=american`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`  OddsAPI ${l.oddsKey}: HTTP ${res.status}`); return events; }
  const games = await res.json();
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) console.log(`  OddsAPI credits remaining: ${remaining}`);
  for (const ev of events) {
    const g = games.find((x) => {
      const h = norm(x.home_team), a = norm(x.away_team);
      const eh = norm(ev.homeName), ea = norm(ev.awayName);
      return (eh.includes(h) || h.includes(eh)) && (ea.includes(a) || a.includes(ea));
    });
    if (!g) continue;
    const bk = g.bookmakers?.[0];
    const h2h = bk?.markets?.find((m) => m.key === "h2h");
    const mlH = h2h?.outcomes?.find((o) => norm(o.name) === norm(g.home_team))?.price;
    const mlA = h2h?.outcomes?.find((o) => norm(o.name) === norm(g.away_team))?.price;
    const pair = normalizePair(mlToImplied(mlH), mlToImplied(mlA));
    if (pair) { ev.probHome = pair.home; ev.probAway = pair.away; ev.source = "oddsapi"; }
    const totals = bk?.markets?.find((m) => m.key === "totals");
    const pt = totals?.outcomes?.[0]?.point;
    if (typeof pt === "number") ev.total = pt;
  }
  return events;
}

async function writeSlate(ev) {
  const ref = db.collection("slates").doc(ev.id);
  await ref.set({
    creatorId: null, title: ev.title, description: null, category: ev.category, status: "live",
    entryTiers: tiers, entryCount: 0, isCardRush: false, rushMultiplier: 1, maxEntries: null,
    lockTime: Timestamp.fromMillis(ev.lockMs), promotionOpensAt: Timestamp.fromMillis(now - DAY),
    settledAt: null, cancelledAt: null, creatorBonusCents: 0, source: ev.source,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const preds = [{
    id: "p1", question: "Who wins?", optionA: ev.homeName, optionB: ev.awayName,
    optionAProbability: ev.probHome, optionBProbability: ev.probAway, predictionType: "binary", overUnderLine: null,
  }];
  if (ev.total != null) {
    preds.push({
      id: "p2", question: "Total", optionA: `Over ${ev.total}`, optionB: `Under ${ev.total}`,
      optionAProbability: 50, optionBProbability: 50, predictionType: "over_under", overUnderLine: ev.total,
    });
  }
  let sortOrder = 0;
  for (const p of preds) {
    await ref.collection("predictions").doc(p.id).set({
      question: p.question, optionA: p.optionA, optionB: p.optionB,
      optionAProbability: p.optionAProbability, optionBProbability: p.optionBProbability,
      optionAMultiplier: Math.round((100 / Math.max(1, p.optionAProbability)) * 100) / 100,
      optionBMultiplier: Math.round((100 / Math.max(1, p.optionBProbability)) * 100) / 100,
      predictionType: p.predictionType, overUnderLine: p.overUnderLine,
      result: null, verificationSources: null, verificationConfidence: null, sortOrder: sortOrder++,
    }, { merge: true });
  }
}

let total = 0;
console.log(`Feed sync — source: ESPN${ODDS_KEY ? " + The Odds API (key present)" : " (no Odds API key — using ESPN odds)"}`);
for (const l of LEAGUES) {
  try {
    let events = await fetchESPN(l);
    events = await enrichWithOddsAPI(l, events);
    events = events.slice(0, PER_LEAGUE);
    for (const ev of events) await writeSlate(ev);
    total += events.length;
    console.log(`  ${l.category}: ${events.length} upcoming`);
  } catch (e) { console.error(`  ${l.league} failed: ${e.message}`); }
}
console.log(`Synced ${total} real slates.`);
process.exit(0);
