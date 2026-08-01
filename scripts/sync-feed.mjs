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

// Mirror of H2H_CONFIG + H2H_STEMS (crossGame.ts). Multiple stats per league + multiple stems.
const H2H = {
  mlb: [ { leaderCat: "RBIs", boxLabel: "H", statLabel: "hits" }, { leaderCat: "homeRuns", boxLabel: "HR", statLabel: "home runs" } ],
  wnba: [ { leaderCat: "points", boxLabel: "PTS", statLabel: "points" }, { leaderCat: "rebounds", boxLabel: "REB", statLabel: "rebounds" }, { leaderCat: "assists", boxLabel: "AST", statLabel: "assists" } ],
  nba: [ { leaderCat: "points", boxLabel: "PTS", statLabel: "points" }, { leaderCat: "rebounds", boxLabel: "REB", statLabel: "rebounds" }, { leaderCat: "assists", boxLabel: "AST", statLabel: "assists" } ],
  nfl: [ { leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" }, { leaderCat: "rushingYards", boxLabel: "YDS", statLabel: "rushing yards" } ],
  "college-football": [ { leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" }, { leaderCat: "rushingYards", boxLabel: "YDS", statLabel: "rushing yards" } ],
  nhl: [ { leaderCat: "points", boxLabel: "P", statLabel: "points" }, { leaderCat: "goals", boxLabel: "G", statLabel: "goals" } ],
  "usa.1": [ { leaderCat: "goals", boxLabel: "G", statLabel: "goals" } ],
  "eng.1": [ { leaderCat: "goals", boxLabel: "G", statLabel: "goals" } ],
};
const STEMS = ["More {stat} tonight?", "Who racks up more {stat}?", "Bigger {stat} night?", "Who shows out — most {stat}?", "Who takes the {stat} edge?", "Who piles up more {stat}?"];

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
  const stats = H2H[l.league]; if (!stats || !stats.length) return null;
  const gs = [...games].sort((a, b) => a.startMs - b.startMs);
  if (gs.length < 2) return null;
  const legs = []; const usedStems = new Set(); let statIdx = 0, stemIdx = 0;
  for (let i = 0; i + 1 < gs.length && legs.length < STEMS.length; i += 2) {
    let A = null, B = null, stat = null;
    for (let s = 0; s < stats.length; s++) {
      const cand = stats[(statIdx + s) % stats.length];
      const a = pickTop(gs[i], cand.leaderCat), b = pickTop(gs[i + 1], cand.leaderCat);
      if (a && b && a.eventId !== b.eventId) { A = a; B = b; stat = cand; statIdx = (statIdx + s + 1) % stats.length; break; }
    }
    if (!A || !B || !stat) continue;
    let stem = null;
    for (let s = 0; s < STEMS.length; s++) {
      const cand = STEMS[(stemIdx + s) % STEMS.length];
      const q = cand.replace("{stat}", stat.statLabel);
      if (!usedStems.has(cand) && !legs.some((x) => x.question === q)) { stem = cand; stemIdx = (stemIdx + s + 1) % STEMS.length; break; }
    }
    if (!stem) continue;
    usedStems.add(stem);
    const probA = lean(A.seasonVal, B.seasonVal);
    legs.push({
      question: stem.replace("{stat}", stat.statLabel),
      optionA: `${A.name} · ${A.team} · ${A.seasonVal} ${stat.statLabel} (season)`,
      optionB: `${B.name} · ${B.team} · ${B.seasonVal} ${stat.statLabel} (season)`,
      probA, probB: 100 - probA,
      h2h: { stat: stat.statLabel, boxLabel: stat.boxLabel, a: A, b: B },
    });
  }
  if (!legs.length) return null;
  return { slateId: `h2h-${l.league}`, title: `${l.category} tonight — head to head`, category: l.category, lockMs: Math.min(...gs.map((g) => g.startMs)), legs };
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
    if (!s) { console.log(`  ${l.category}: no usable slate (need ≥2 games with a ${H2H[l.league]?.[0]?.leaderCat} leader)`); continue; }
    const n = await writeSlate(s);
    slates++; legs += n;
    console.log(`  ${l.category}: ${s.slateId} (${n} head-to-head legs)`);
  } catch (err) { console.error(`  ${l.league} failed`, err.message); }
}
console.log(`\nDone — ${slates} cross-game slates, ${legs} legs.`);
process.exit(0);
