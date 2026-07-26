/**
 * REAL data-feed sync — writes live prediction slates into Firestore from real schedules + odds.
 *
 *   node --env-file=.env.local scripts/sync-feed.mjs   (or: npm run sync:feed)
 *
 * Source: ESPN's public scoreboard (no key) carries DraftKings odds — moneyline, spread (run/puck/
 * point line), and totals — so each game becomes a MULTI-MARKET slate, not just "who wins". If
 * THE_ODDS_API_KEY is set we additionally refine the moneyline/total from The Odds API consensus.
 * Player props (player stats) need The Odds API per-event endpoint (paid markets) — see NEXT below.
 *
 * Slate/prediction doc shape mirrors scripts/seed-firestore.mjs / src/lib/firebase/types.ts exactly.
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
const PER_LEAGUE = 8;
const HORIZON_MS = 10 * DAY;
const tiers = [{ tier: 5, hostingFeeCents: 100 }, { tier: 10, hostingFeeCents: 200 }, { tier: 25, hostingFeeCents: 300 }];

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

// Per-sport market labels (DraftKings-style).
const MKT = {
  MLB: { spread: "Run line", total: "Total runs" },
  NHL: { spread: "Puck line", total: "Total goals" },
  NBA: { spread: "Point spread", total: "Total points" },
  WNBA: { spread: "Point spread", total: "Total points" },
  NFL: { spread: "Point spread", total: "Total points" },
  CFB: { spread: "Point spread", total: "Total points" },
  Soccer: { spread: "Goal spread", total: "Total goals" },
};
const labelsFor = (cat) => MKT[cat] ?? { spread: "Spread", total: "Total" };

/** American odds string/number ("-115","+133") → number. */
function amOdds(v) { if (v == null) return null; const n = Number(String(v).replace(/^\+/, "")); return Number.isNaN(n) ? null : n; }
/** American moneyline → implied probability (0..1), vig included. */
function mlToImplied(ml) { if (ml == null) return null; const n = Number(ml); return n < 0 ? -n / (-n + 100) : 100 / (n + 100); }
/** De-vig a pair of implied probs into whole % that sum to 100. */
function pair(iA, iB) {
  if (iA == null || iB == null || iA + iB <= 0) return null;
  const a = Math.min(99, Math.max(1, Math.round((100 * iA) / (iA + iB))));
  return { a, b: 100 - a };
}
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Build the market questions for one game from ESPN's DraftKings odds block. */
function buildPredictions(o, homeName, awayName, cat) {
  const L = labelsFor(cat);
  const preds = [];
  // 1) Moneyline — who wins
  const ml = pair(mlToImplied(amOdds(o?.moneyline?.home?.close?.odds)), mlToImplied(amOdds(o?.moneyline?.away?.close?.odds)));
  preds.push({ id: "ml", question: "Who wins?", optionA: homeName, optionB: awayName, probA: ml?.a ?? 50, probB: ml?.b ?? 50, type: "binary", line: null });
  // 2) Spread / run line / puck line
  const spH = o?.pointSpread?.home?.close, spA = o?.pointSpread?.away?.close;
  if (spH?.line && spA?.line) {
    const sp = pair(mlToImplied(amOdds(spH.odds)), mlToImplied(amOdds(spA.odds)));
    preds.push({ id: "spread", question: L.spread, optionA: `${homeName} ${spH.line}`, optionB: `${awayName} ${spA.line}`, probA: sp?.a ?? 50, probB: sp?.b ?? 50, type: "binary", line: typeof o?.spread === "number" ? o.spread : null });
  }
  // 3) Total — over/under
  const totLine = typeof o?.overUnder === "number" ? o.overUnder : null;
  if (totLine != null) {
    const tot = pair(mlToImplied(amOdds(o?.total?.over?.close?.odds)), mlToImplied(amOdds(o?.total?.under?.close?.odds)));
    preds.push({ id: "total", question: L.total, optionA: `Over ${totLine}`, optionB: `Under ${totLine}`, probA: tot?.a ?? 50, probB: tot?.b ?? 50, type: "over_under", line: totLine });
  }
  return preds;
}

async function fetchESPN(l) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`);
  if (!res.ok) { console.error(`  ESPN ${l.league}: HTTP ${res.status}`); return []; }
  const data = await res.json();
  const out = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const start = new Date(ev.date).getTime();
    if (start <= now || start > now + HORIZON_MS) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    const homeName = home.team.displayName, awayName = away.team.displayName;
    out.push({
      id: `espn-${l.league}-${ev.id}`, title: `${awayName} @ ${homeName}`, category: l.category, lockMs: start,
      homeName, awayName, source: "espn", predictions: buildPredictions(comp.odds?.[0] ?? {}, homeName, awayName, l.category),
    });
  }
  return out;
}

/** Optional: refine the moneyline/total from The Odds API bookmaker consensus (key-gated). */
async function enrichWithOddsAPI(l, events) {
  if (!ODDS_KEY || events.length === 0) return;
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/${l.oddsKey}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=h2h,totals&oddsFormat=american`);
  if (!res.ok) { console.error(`  OddsAPI ${l.oddsKey}: HTTP ${res.status}`); return; }
  const games = await res.json();
  const rem = res.headers.get("x-requests-remaining");
  if (rem) console.log(`  OddsAPI credits remaining: ${rem}`);
  for (const ev of events) {
    const g = games.find((x) => { const h = norm(x.home_team), a = norm(x.away_team), eh = norm(ev.homeName), ea = norm(ev.awayName); return (eh.includes(h) || h.includes(eh)) && (ea.includes(a) || a.includes(ea)); });
    if (!g) continue;
    const bk = g.bookmakers?.[0];
    const h2h = bk?.markets?.find((m) => m.key === "h2h");
    const mlp = pair(mlToImplied(amOdds(h2h?.outcomes?.find((o) => norm(o.name) === norm(g.home_team))?.price)), mlToImplied(amOdds(h2h?.outcomes?.find((o) => norm(o.name) === norm(g.away_team))?.price)));
    const mlPred = ev.predictions.find((p) => p.id === "ml");
    if (mlp && mlPred) { mlPred.probA = mlp.a; mlPred.probB = mlp.b; ev.source = "oddsapi"; }
  }
}

async function writeSlate(ev) {
  const ref = db.collection("slates").doc(ev.id);
  await ref.set({
    creatorId: null, title: ev.title, description: null, category: ev.category, status: "live",
    entryTiers: tiers, entryCount: 0, isCardRush: false, rushMultiplier: 1, maxEntries: null,
    lockTime: Timestamp.fromMillis(ev.lockMs), promotionOpensAt: Timestamp.fromMillis(now - DAY),
    settledAt: null, cancelledAt: null, creatorBonusCents: 0, source: ev.source, createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  let sortOrder = 0;
  for (const p of ev.predictions) {
    await ref.collection("predictions").doc(p.id).set({
      question: p.question, optionA: p.optionA, optionB: p.optionB,
      optionAProbability: p.probA, optionBProbability: p.probB,
      optionAMultiplier: Math.round((100 / Math.max(1, p.probA)) * 100) / 100,
      optionBMultiplier: Math.round((100 / Math.max(1, p.probB)) * 100) / 100,
      predictionType: p.type, overUnderLine: p.line,
      result: null, verificationSources: null, verificationConfidence: null, sortOrder: sortOrder++,
    }, { merge: true });
  }
  // Drop any stale extra predictions from a prior run (e.g. a market that disappeared).
  const existing = await ref.collection("predictions").get();
  const keep = new Set(ev.predictions.map((p) => p.id));
  for (const d of existing.docs) if (!keep.has(d.id)) await d.ref.delete();
}

let total = 0, markets = 0;
console.log(`Feed sync — ESPN DraftKings odds${ODDS_KEY ? " + The Odds API refine" : ""}`);
for (const l of LEAGUES) {
  try {
    let events = await fetchESPN(l);
    await enrichWithOddsAPI(l, events);
    events = events.slice(0, PER_LEAGUE);
    for (const ev of events) { await writeSlate(ev); markets += ev.predictions.length; }
    total += events.length;
    console.log(`  ${l.category}: ${events.length} games`);
  } catch (e) { console.error(`  ${l.league} failed: ${e.message}`); }
}
console.log(`Synced ${total} real slates, ${markets} markets total (avg ${total ? (markets / total).toFixed(1) : 0}/game).`);
console.log(`NEXT: player props (player stats) need The Odds API per-event endpoint — a paid-tier add-on.`);
process.exit(0);
