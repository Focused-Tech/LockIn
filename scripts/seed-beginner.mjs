/**
 * Seed walkable BEGINNER-JOURNEY data (idempotent, fixed ids).
 *
 * WHY THIS EXISTS: the base seed (`npm run seed`) creates platform slates with
 * creatorId=null, and `npm run seed:creators` creates creators that own no
 * slates. The beginner feed is creator-anchored, so without this it would show
 * only the house "LockIn" anchor. This script links real creator-owned live
 * slates (with several picks each, for combos) and sets `creatorHitRate` on
 * those creators so the journey is walkable end-to-end with REAL data.
 *
 * These hit-rate values are SEED/DEMO placeholders (there is no creator-accuracy
 * engine yet) — real creators have a null hit-rate and render "no track record
 * yet" in the UI.
 *
 * Usage (Admin creds required; run after `npm run seed:creators`):
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *     npm run seed:beginner
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();
const now = Date.now();
const DAY = 86_400_000;

const tiers = [
  { tier: 5, hostingFeeCents: 100 },
  { tier: 10, hostingFeeCents: 200 },
  { tier: 25, hostingFeeCents: 300 },
];

// Demo hit-rates for the two anchor creators (seed placeholders only).
const CREATOR_HIT_RATES = {
  "seed-creator-01": 64, // hoopsdaily
  "seed-creator-05": 59, // degencharts
};

const SLATES = [
  {
    id: "seed-beg-nba",
    creatorId: "seed-creator-01",
    title: "Tonight's NBA slate",
    category: "NBA",
    lockInDays: 0.25,
    entryCount: 1200,
    predictions: [
      { id: "p1", question: "Will the Lakers beat the Suns tonight?", a: 61, b: 39 },
      { id: "p2", question: "Will LeBron score 25 or more?", a: 58, b: 42 },
      { id: "p3", question: "Will the game go over 220 total points?", a: 53, b: 47 },
      { id: "p4", question: "Will the Warriors cover the spread?", a: 49, b: 51 },
    ],
  },
  {
    id: "seed-beg-crypto",
    creatorId: "seed-creator-05",
    title: "This week in crypto",
    category: "Crypto",
    lockInDays: 1.5,
    entryCount: 640,
    predictions: [
      { id: "p1", question: "Will Bitcoin close above $90k Friday?", a: 54, b: 46 },
      { id: "p2", question: "Will ETH outperform BTC this week?", a: 47, b: 53 },
      { id: "p3", question: "Will gas dip below $3 this week?", a: 57, b: 43 },
    ],
  },
];

// COMPLIANCE — mirror of detectBannedArchetype. A slate with only banned legs is NOT seeded.
const BANNED_RE = [
  /\bwho\s+wins?\b|\bgame\s+winner\b|\bto\s+win\b|\bwinner\b|\bbeats?\s+the\b/i,
  /\bspread\b|\bgoal\s+spread\b|\bcover(s|ing)?\s+the\b/i,
  /\b(over|under)\b|\btotal\s+(goals|points|runs|score|yards)\b/i,
  /\bhalftime\b|\bfirst\s+half\b|\bquarter\b|\bperiod\b/i,
  /\bto\s+score\b|\bscores?\s+\d+\s+or\s+more\b|\b\d+\s*\+\s*(points|goals|assists|rebounds|yards)\b/i,
];
function isBanned(p) {
  return p.predictionType === "over_under" || BANNED_RE.some((re) => re.test(p.question || ""));
}

async function run() {
  // 1) stamp demo hit-rates on the anchor creators
  for (const [uid, rate] of Object.entries(CREATOR_HIT_RATES)) {
    await db.collection("users").doc(uid).set({ creatorHitRate: rate }, { merge: true });
  }

  // 2) creator-owned live slates with several binary (Yes/No) picks
  let skipped = 0;
  for (const s of SLATES) {
    // COMPLIANCE — withhold a slate whose legs are all banned archetypes (can't be regenerated here).
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
    const slateRef = db.collection("slates").doc(s.id);
    await slateRef.set({
      creatorId: s.creatorId,
      title: s.title,
      description: null,
      category: s.category,
      status: "live",
      entryTiers: tiers,
      entryCount: s.entryCount,
      isCardRush: false,
      rushMultiplier: 1,
      maxEntries: null,
      lockTime: Timestamp.fromMillis(now + s.lockInDays * DAY),
      promotionOpensAt: Timestamp.fromMillis(now - 2 * DAY),
      settledAt: null,
      cancelledAt: null,
      creatorBonusCents: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    let sortOrder = 0;
    for (const p of s.predictions) {
      await slateRef.collection("predictions").doc(p.id).set({
        question: p.question,
        optionA: "Yes",
        optionB: "No",
        optionAProbability: p.a,
        optionBProbability: p.b,
        optionAMultiplier: Math.round((100 / p.a) * 100) / 100,
        optionBMultiplier: Math.round((100 / p.b) * 100) / 100,
        predictionType: "binary",
        overUnderLine: null,
        result: null,
        verificationSources: null,
        verificationConfidence: null,
        sortOrder: sortOrder++,
      });
    }
    console.log(`seeded ${s.id} (creator ${s.creatorId}, ${s.predictions.length} picks)`);
  }

  console.log(
    `Done — ${SLATES.length} creator-owned slates + ${Object.keys(CREATOR_HIT_RATES).length} hit-rates.`,
  );
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
