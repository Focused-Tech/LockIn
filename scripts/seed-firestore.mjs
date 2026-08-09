/**
 * Seed sample contest data into Firestore.
 *
 * Usage:  node --env-file=.env.local scripts/seed-firestore.mjs
 *
 * Idempotent: slates/predictions use fixed document ids, so re-running overwrites. Dates are relative
 * (now + lockInDays) so a fresh run always produces LIVE, unlocked slates.
 *
 * P3: every slate carries 5–6 COMPLIANT legs (cross-game comparisons / event naming — never team
 * outcomes, scores, player-prop thresholds, spreads, or over/unders). They survive the same validator
 * the entry/settlement paths use — the filter is NOT relaxed; the questions are authored to pass it.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const tiers = [
  { tier: 5, hostingFeeCents: 100 },
  { tier: 10, hostingFeeCents: 200 },
  { tier: 25, hostingFeeCents: 300 },
];

/** Compliant binary leg helper. */
const L = (id, question, a, b, pa) => ({
  id,
  question,
  optionA: a,
  optionB: b,
  optionAProbability: pa,
  optionBProbability: 100 - pa,
  predictionType: "binary",
  overUnderLine: null,
});

// 5–6 compliant legs each. Comparisons ("who does more of X") + event/storyline naming — no scores,
// props, spreads, over/unders, or team-win questions.
const SLATES = [
  {
    id: "seed-nba-duel", title: "NBA — Backcourt & Wings", category: "NBA", status: "live", entryCount: 2890, lockInDays: 1,
    predictions: [
      L("p1", "Who finishes with more assists tonight?", "The home playmaker", "The visiting playmaker", 53),
      L("p2", "Which wing grabs more rebounds?", "The home wing", "The visiting wing", 49),
      L("p3", "Who records more steals in the marquee game?", "The home guard", "The visiting guard", 51),
      L("p4", "Which matchup is tonight's headline?", "The West Coast rivalry", "The East Coast showdown", 55),
      L("p5", "Which storyline leads NBA coverage tonight?", "The star's return", "The rookie's showcase", 52),
      L("p6", "Who's the bigger story off the bench?", "The veteran spark", "The young riser", 50),
    ],
  },
  {
    id: "seed-nfl-duel", title: "NFL — Sunday Ground & Air", category: "NFL", status: "live", entryCount: 6100, lockInDays: 3,
    predictions: [
      L("p1", "Which back racks up more rushing yards?", "The home back", "The visiting back", 52),
      L("p2", "Which receiver sees more targets?", "The home receiver", "The visiting receiver", 50),
      L("p3", "Which game is the Sunday headliner?", "The division rivalry", "The primetime rematch", 54),
      L("p4", "Which defense forces the bigger momentum swing?", "The home defense", "The visiting defense", 49),
      L("p5", "Which debut is the week's bigger story?", "The rookie starter", "The new signing", 51),
    ],
  },
  {
    id: "seed-mlb-deadline", title: "MLB — Weekend Diamond", category: "MLB", status: "live", entryCount: 5240, lockInDays: 2,
    predictions: [
      L("p1", "Which starter logs more innings?", "The home starter", "The visiting starter", 51),
      L("p2", "Which lineup manufactures more baserunners?", "The home lineup", "The visiting lineup", 50),
      L("p3", "Which series is the weekend's featured matchup?", "The coastal rivalry", "The division clash", 53),
      L("p4", "Which bullpen is the more rested?", "The home bullpen", "The visiting bullpen", 49),
      L("p5", "Which callup is the bigger story?", "The top prospect", "The two-way arm", 50),
    ],
  },
  {
    id: "seed-epl-opener", title: "Soccer — Matchday Headlines", category: "Soccer", status: "live", entryCount: 3350, lockInDays: 4,
    predictions: [
      L("p1", "Which winger creates more chances?", "The home winger", "The visiting winger", 52),
      L("p2", "Which midfield controls more possession?", "The home midfield", "The visiting midfield", 50),
      L("p3", "Which fixture is the weekend headliner?", "The title-race clash", "The derby", 55),
      L("p4", "Which side's press is more aggressive early?", "The home press", "The visiting press", 49),
      L("p5", "Which debut draws more attention?", "The new striker", "The academy call-up", 51),
    ],
  },
  {
    id: "seed-ufc-main", title: "UFC — Fight Night Card", category: "UFC", status: "live", entryCount: 1080, lockInDays: 2,
    predictions: [
      L("p1", "Which main-card bout is the headliner?", "The title eliminator", "The grudge rematch", 54),
      L("p2", "Which fighter attempts more takedowns?", "The wrestler", "The grappler", 50),
      L("p3", "Which striker sets the higher pace?", "The pressure fighter", "The counter-striker", 51),
      L("p4", "Which grappler controls more clinch time?", "The clinch specialist", "The scrambler", 49),
      L("p5", "Which debut makes the bigger splash?", "The prospect", "The short-notice call", 52),
    ],
  },
  {
    id: "seed-hiphop-chart", title: "Hip-Hop — Friday Rollout", category: "Hip Hop", status: "live", entryCount: 1740, lockInDays: 2,
    predictions: [
      L("p1", "Which release is the bigger drop this Friday?", "The veteran's album", "The newcomer's mixtape", 55),
      L("p2", "Which single climbs the chart higher this week?", "The streaming favorite", "The radio pick", 52),
      L("p3", "Which verse racks up more streams?", "The opener", "The closer", 50),
      L("p4", "Which feature is more in demand?", "The chart-topper", "The underground favorite", 51),
      L("p5", "Which rollout gets more buzz?", "The surprise drop", "The rollout campaign", 49),
    ],
  },
  {
    id: "seed-reality-buzz", title: "Reality TV — Premiere Week", category: "Reality TV", status: "live", entryCount: 980, lockInDays: 2,
    predictions: [
      L("p1", "Which premiere is the talk of the week?", "The returning franchise", "The buzzy new series", 54),
      L("p2", "Which cast member drives the drama?", "The veteran instigator", "The newcomer", 50),
      L("p3", "Which reunion trends first this weekend?", "The original cast", "The new cast", 52),
      L("p4", "Which cliffhanger gets more buzz?", "The competition twist", "The dating-show shock", 51),
      L("p5", "Which spinoff pulls the bigger audience?", "The flagship spinoff", "The fresh format", 49),
    ],
  },
];

/** Old seed ids to clear so the feed isn't cluttered with expired slates from earlier seeds. */
const STALE_SEED_IDS = [
  "seed-daytona-500", "seed-nba-finals-g5", "seed-worlds-final", "seed-nfl-locked", "seed-boxing-rush",
  "seed-wnba-primetime", "seed-btc-target", "seed-nfl-preseason", "seed-tennis-cincy",
];

// COMPLIANCE — mirror of detectBannedArchetype. A slate with only banned legs is NOT seeded. The
// filter is authoritative; the seed above is authored to pass it intact.
const BANNED_RE = [
  /\bwho\s+wins?\b|\bmoneyline\b|\bgame\s+winner\b|\bto\s+win\b|\bwinner\b|\bbeats?\s+the\b/i,
  /\bspread\b|\brun\s*line\b|\bpuck\s*line\b|\bgoal\s+spread\b|\bcover(s|ing)?\s+the\b/i,
  /\b(over|under)\b|\btotal\s+(goals|points|runs|score|trades|hits|yards)\b/i,
  /\bhalftime\b|\b1st\s+half\b|\bfirst\s+half\b|\bquarter\b|\bperiod\b/i,
  /\bto\s+score\b|\bscores?\s+\d+\s+or\s+more\b|\b\d+\s*\+\s*(points|goals|assists|rebounds|yards)\b/i,
];
const SPREAD_OPT = /(^|\s)[+-]\d+(\.\d+)?\s*$/;
function isBanned(p) {
  if (p.predictionType === "over_under" || p.type === "over_under") return true;
  const hay = [p.question, p.optionA, p.optionB].filter(Boolean);
  if (BANNED_RE.some((re) => hay.some((s) => re.test(s)))) return true;
  return [p.optionA, p.optionB].some((o) => o && SPREAD_OPT.test(String(o).trim()));
}

async function run() {
  for (const id of STALE_SEED_IDS) {
    const ref = db.collection("slates").doc(id);
    const preds = await ref.collection("predictions").get();
    for (const p of preds.docs) await p.ref.delete();
    await ref.delete().catch(() => {});
    console.log(`cleared stale ${id}`);
  }

  let skipped = 0;
  for (const s of SLATES) {
    const before = s.predictions.length;
    const compliant = s.predictions.filter((p) => !isBanned(p));
    if (compliant.length === 0) {
      const ref = db.collection("slates").doc(s.id);
      const preds = await ref.collection("predictions").get();
      for (const p of preds.docs) await p.ref.delete();
      await ref.delete().catch(() => {});
      skipped++;
      console.log(`WITHHELD ${s.id} — all legs banned, not seeded`);
      continue;
    }
    s.predictions = compliant;
    const lockMs = now + s.lockInDays * DAY;
    const slateRef = db.collection("slates").doc(s.id);

    await slateRef.set({
      creatorId: null, title: s.title, description: null, category: s.category, status: s.status,
      entryTiers: tiers, entryCount: s.entryCount, isCardRush: false, rushMultiplier: 1, maxEntries: null,
      lockTime: Timestamp.fromMillis(lockMs), promotionOpensAt: Timestamp.fromMillis(now - 2 * DAY),
      settledAt: null, cancelledAt: null, creatorBonusCents: 0, createdAt: FieldValue.serverTimestamp(),
    });

    let sortOrder = 0;
    for (const p of s.predictions) {
      await slateRef.collection("predictions").doc(p.id).set({
        question: p.question, optionA: p.optionA, optionB: p.optionB,
        optionAProbability: p.optionAProbability, optionBProbability: p.optionBProbability,
        optionAMultiplier: Math.round((100 / p.optionAProbability) * 100) / 100,
        optionBMultiplier: Math.round((100 / p.optionBProbability) * 100) / 100,
        predictionType: p.predictionType, overUnderLine: p.overUnderLine,
        result: null, verificationSources: null, verificationConfidence: null, sortOrder: sortOrder++,
      });
    }
    console.log(`seeded ${s.id}: ${before} authored -> ${s.predictions.length} live legs`);
  }
  console.log(`Done — ${SLATES.length - skipped} slates seeded, ${skipped} withheld.`);
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
