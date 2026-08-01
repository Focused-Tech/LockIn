/**
 * REAL data-feed sync (CLI twin of src/server/feeds/sync.ts + crossGame.ts). ESPN's scoreboard is the
 * DATA source only — its betting markets (moneyline / spread / total) are banned archetypes and are NOT
 * served. Each league's games become ONE compliant CROSS-GAME HEAD-TO-HEAD slate: standout players
 * (from ESPN stat `leaders`) paired across DIFFERENT games. Keep in sync with the server module.
 *
 * Run: node --env-file=.env.local scripts/sync-feed.mjs
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) { console.error("Missing FIREBASE_* creds"); process.exit(1); }
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const now = Date.now(), DAY = 86400000, HORIZON_MS = 10 * DAY, PER_LEAGUE = 8;
const tiers = [ { tier: 5, hostingFeeCents: 100 }, { tier: 10, hostingFeeCents: 200 }, { tier: 25, hostingFeeCents: 300 } ];

const LEAGUES = [
  { sport: "baseball", league: "mlb", category: "MLB" },
  { sport: "basketball", league: "wnba", category: "WNBA" },
  { sport: "soccer", league: "usa.1", category: "Soccer" },
  { sport: "soccer", league: "eng.1", category: "Soccer" },
  { sport: "football", league: "nfl", category: "NFL" },
  { sport: "football", league: "college-football", category: "CFB" },
  { sport: "basketball", league: "nba", category: "NBA" },
  { sport: "hockey", league: "nhl", category: "NHL" },
];

// Mirror of H2H_CONFIG (crossGame.ts).
const H2H = {
  mlb: { leaderCat: "RBIs", statLabel: "hits" },
  wnba: { leaderCat: "points", statLabel: "points" },
  nba: { leaderCat: "points", statLabel: "points" },
  nfl: { leaderCat: "passingYards", statLabel: "passing yards" },
  "college-football": { leaderCat: "passingYards", statLabel: "passing yards" },
  nhl: { leaderCat: "points", statLabel: "points" },
  "usa.1": { leaderCat: "goals", statLabel: "goals" },
  "eng.1": { leaderCat: "goals", statLabel: "goals" },
};
const BOX = { hits: "H", points: "PTS", "passing yards": "YDS", goals: "G" };

async function fetchGames(l) {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${l.sport}/${l.league}/scoreboard`);
  if (!res.ok) { console.error(`  ESPN ${l.league}: HTTP ${res.status}`); return []; }
  const data = await res.json();
  const out = [];
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0]; if (!comp) continue;
    const start = new Date(ev.date).getTime();
    if (start <= now || start > now + HORIZON_MS) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team || !away?.team) continue;
    out.push({ eventId: String(ev.id), startMs: start, competitors: comp.competitors ?? [] });
  }
  return out;
}

function pickTop(game, leaderCat) {
  let best = null;
  for (const comp of game.competitors || []) {
    const team = comp?.team?.displayName ?? "";
    const cat = (comp?.leaders || []).find((L) => L?.name === leaderCat);
    const top = cat?.leaders?.[0], ath = top?.athlete;
    if (!ath?.id || !ath?.displayName) continue;
    const val = Number(top?.value ?? 0);
    if (!best || val > best.seasonVal) best = { playerId: String(ath.id), name: ath.displayName, team, eventId: game.eventId, seasonVal: Number.isFinite(val) ? val : 0 };
  }
  return best;
}
const lean = (a, b) => (a + b <= 0 ? 50 : Math.min(60, Math.max(40, Math.round((100 * a) / (a + b)))));

function buildSlate(l, games) {
  const cfg = H2H[l.league]; if (!cfg) return null;
  const tops = games.map((g) => ({ g, p: pickTop(g, cfg.leaderCat) })).filter((x) => x.p).sort((x, y) => x.g.startMs - y.g.startMs);
  if (tops.length < 2) return null;
  const legs = [];
  for (let i = 0; i + 1 < tops.length; i += 2) {
    const A = tops[i].p, B = tops[i + 1].p;
    if (A.eventId === B.eventId) continue;
    const probA = lean(A.seasonVal, B.seasonVal);
    legs.push({
      question: `More ${cfg.statLabel} tonight?`,
      optionA: `${A.name} · ${A.team} · ${A.seasonVal} ${cfg.statLabel} (season)`,
      optionB: `${B.name} · ${B.team} · ${B.seasonVal} ${cfg.statLabel} (season)`,
      probA, probB: 100 - probA,
      h2h: { stat: cfg.statLabel, boxLabel: BOX[cfg.statLabel], a: A, b: B },
    });
  }
  if (!legs.length) return null;
  return { slateId: `h2h-${l.league}`, title: `${l.category} tonight — head to head`, category: l.category, lockMs: Math.min(...tops.map((t) => t.g.startMs)), legs };
}

async function writeSlate(s) {
  const ref = db.collection("slates").doc(s.slateId);
  await ref.set({
    creatorId: null, title: s.title, description: null, category: s.category, status: "live",
    entryTiers: tiers, entryCount: 0, isCardRush: false, rushMultiplier: 1, maxEntries: null,
    lockTime: Timestamp.fromMillis(s.lockMs), promotionOpensAt: Timestamp.fromMillis(now - DAY),
    settledAt: null, cancelledAt: null, creatorBonusCents: 0, source: "espn", createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  let i = 0;
  for (const leg of s.legs) {
    await ref.collection("predictions").doc(`h${i}`).set({
      question: leg.question, optionA: leg.optionA, optionB: leg.optionB,
      optionAProbability: leg.probA, optionBProbability: leg.probB,
      optionAMultiplier: Math.round((100 / Math.max(1, leg.probA)) * 100) / 100,
      optionBMultiplier: Math.round((100 / Math.max(1, leg.probB)) * 100) / 100,
      predictionType: "binary", overUnderLine: null, result: null,
      verificationSources: null, verificationConfidence: null, sortOrder: i, h2h: leg.h2h,
    }, { merge: true });
    i++;
  }
  const existing = await ref.collection("predictions").get();
  const keep = new Set(s.legs.map((_, k) => `h${k}`));
  for (const d of existing.docs) if (!keep.has(d.id)) await d.ref.delete();
  return s.legs.length;
}

let slates = 0, legs = 0;
console.log("Feed sync — ESPN games → cross-game head-to-head");
for (const l of LEAGUES) {
  try {
    const games = (await fetchGames(l)).slice(0, PER_LEAGUE);
    const s = buildSlate(l, games);
    if (!s) { console.log(`  ${l.category}: no usable slate (need ≥2 games with a ${H2H[l.league]?.leaderCat} leader)`); continue; }
    const n = await writeSlate(s);
    slates++; legs += n;
    console.log(`  ${l.category}: ${s.slateId} (${n} head-to-head legs)`);
  } catch (err) { console.error(`  ${l.league} failed`, err.message); }
}
console.log(`\nDone — ${slates} cross-game slates, ${legs} legs.`);
process.exit(0);
