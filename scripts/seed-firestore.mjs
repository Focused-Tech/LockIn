/**
 * Seed sample contest data into Firestore.
 *
 * Usage (env must hold the Admin service-account creds):
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *     npm run seed
 *
 * Idempotent: slates/predictions use fixed document ids, so re-running overwrites.
 * Field names mirror src/lib/firebase/types.ts exactly.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY",
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const tiers = [
  { tier: 5, hostingFeeCents: 100 },
  { tier: 10, hostingFeeCents: 200 },
  { tier: 25, hostingFeeCents: 300 },
];

// CURRENT / UPCOMING events (undecided — these are real-money PREDICTIONS, not settled trivia). Dates
// are relative (now + lockInDays), so a fresh `npm run seed` always produces LIVE, unlocked slates.
const SLATES = [
  {
    id: "seed-mlb-deadline",
    title: "MLB Trade Deadline — Blockbuster Watch",
    category: "MLB",
    status: "live",
    entryCount: 5240,
    lockInDays: 2,
    predictions: [
      {
        id: "p1",
        question: "Does a former All-Star get traded before the deadline?",
        optionA: "Yes",
        optionB: "No",
        optionAProbability: 46,
        optionBProbability: 54,
        predictionType: "binary",
        overUnderLine: null,
      },
      {
        id: "p2",
        question: "Total deadline-day trades",
        optionA: "Over 30.5",
        optionB: "Under 30.5",
        optionAProbability: 52,
        optionBProbability: 48,
        predictionType: "over_under",
        overUnderLine: 30.5,
      },
    ],
  },
  {
    id: "seed-wnba-primetime",
    title: "WNBA Primetime — Aces vs Liberty",
    category: "WNBA",
    status: "live",
    entryCount: 1620,
    lockInDays: 1,
    predictions: [
      {
        id: "p1",
        question: "Who wins?",
        optionA: "Aces",
        optionB: "Liberty",
        optionAProbability: 48,
        optionBProbability: 52,
        predictionType: "binary",
        overUnderLine: null,
      },
      {
        id: "p2",
        question: "Total points",
        optionA: "Over 168.5",
        optionB: "Under 168.5",
        optionAProbability: 50,
        optionBProbability: 50,
        predictionType: "over_under",
        overUnderLine: 168.5,
      },
    ],
  },
  {
    id: "seed-epl-opener",
    title: "Premier League — Opening Weekend",
    category: "Soccer",
    status: "live",
    entryCount: 3350,
    lockInDays: 4,
    predictions: [
      {
        id: "p1",
        question: "Does the defending champion win their opener?",
        optionA: "Wins",
        optionB: "Draw or Loss",
        optionAProbability: 61,
        optionBProbability: 39,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
  {
    id: "seed-tennis-cincy",
    title: "US Open Tune-Up — Cincinnati Final",
    category: "Tennis",
    status: "live",
    entryCount: 610,
    lockInDays: 3,
    predictions: [
      {
        id: "p1",
        question: "Does the final go three sets?",
        optionA: "Three sets",
        optionB: "Straight sets",
        optionAProbability: 43,
        optionBProbability: 57,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
  {
    id: "seed-btc-target",
    title: "BTC above $120K by Friday?",
    category: "Crypto",
    status: "live",
    entryCount: 240,
    lockInDays: 5,
    predictions: [
      {
        id: "p1",
        question: "BTC close Friday",
        optionA: "Over $120,000",
        optionB: "Under $120,000",
        optionAProbability: 41,
        optionBProbability: 59,
        predictionType: "over_under",
        overUnderLine: 120000,
      },
    ],
  },
  {
    id: "seed-ufc-main",
    title: "UFC Fight Night — Main Event",
    category: "UFC",
    status: "live",
    entryCount: 1080,
    lockInDays: 2,
    predictions: [
      {
        id: "p1",
        question: "Does the main event end inside the distance?",
        optionA: "Finish",
        optionB: "Decision",
        optionAProbability: 54,
        optionBProbability: 46,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
  {
    id: "seed-nfl-preseason",
    title: "NFL Preseason — Kickoff (Locked)",
    category: "NFL",
    status: "locked",
    entryCount: 7400,
    lockInDays: -0.1,
    predictions: [
      {
        id: "p1",
        question: "Game winner",
        optionA: "Cowboys",
        optionB: "Rams",
        optionAProbability: 51,
        optionBProbability: 49,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
];

/** Old seed ids to clear so the feed isn't cluttered with expired slates from earlier seeds. */
const STALE_SEED_IDS = [
  "seed-daytona-500",
  "seed-nba-finals-g5",
  "seed-worlds-final",
  "seed-nfl-locked",
  "seed-boxing-rush",
];

async function run() {
  // Clear expired slates from earlier seeds (past lockTime) so Beginner/Advanced only show fresh ones.
  for (const id of STALE_SEED_IDS) {
    const ref = db.collection("slates").doc(id);
    const preds = await ref.collection("predictions").get();
    for (const p of preds.docs) await p.ref.delete();
    await ref.delete();
    console.log(`cleared stale ${id}`);
  }

  for (const s of SLATES) {
    const lockMs = now + s.lockInDays * DAY;
    const slateRef = db.collection("slates").doc(s.id);

    await slateRef.set({
      creatorId: null,
      title: s.title,
      description: null,
      category: s.category,
      status: s.status,
      entryTiers: tiers,
      entryCount: s.entryCount,
      isCardRush: s.isCardRush ?? false,
      rushMultiplier: s.rushMultiplier ?? 1,
      maxEntries: s.maxEntries ?? null,
      lockTime: Timestamp.fromMillis(lockMs),
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
        optionA: p.optionA,
        optionB: p.optionB,
        optionAProbability: p.optionAProbability,
        optionBProbability: p.optionBProbability,
        optionAMultiplier: Math.round((100 / p.optionAProbability) * 100) / 100,
        optionBMultiplier: Math.round((100 / p.optionBProbability) * 100) / 100,
        predictionType: p.predictionType,
        overUnderLine: p.overUnderLine,
        result: null,
        verificationSources: null,
        verificationConfidence: null,
        sortOrder: sortOrder++,
      });
    }

    console.log(`seeded ${s.id} (${s.predictions.length} predictions)`);
  }
  console.log(`Done — ${SLATES.length} slates.`);
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
