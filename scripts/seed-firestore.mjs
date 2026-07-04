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

const SLATES = [
  {
    id: "seed-daytona-500",
    title: "Daytona 500 — Final Lap Showdown",
    category: "NASCAR",
    status: "live",
    entryCount: 4970,
    lockInDays: 2,
    predictions: [
      {
        id: "p1",
        question: "Who finishes higher?",
        optionA: "Chase Elliott",
        optionB: "Ryan Blaney",
        optionAProbability: 58,
        optionBProbability: 42,
        predictionType: "binary",
        overUnderLine: null,
      },
      {
        id: "p2",
        question: "Total lead changes",
        optionA: "Over 34.5",
        optionB: "Under 34.5",
        optionAProbability: 47,
        optionBProbability: 53,
        predictionType: "over_under",
        overUnderLine: 34.5,
      },
    ],
  },
  {
    id: "seed-nba-finals-g5",
    title: "NBA Finals — Game 5",
    category: "NBA",
    status: "live",
    entryCount: 1300,
    lockInDays: 1,
    predictions: [
      {
        id: "p1",
        question: "Total points",
        optionA: "Over 220.5",
        optionB: "Under 220.5",
        optionAProbability: 51,
        optionBProbability: 49,
        predictionType: "over_under",
        overUnderLine: 220.5,
      },
    ],
  },
  {
    id: "seed-worlds-final",
    title: "Worlds Grand Final — Map 1",
    category: "Esports",
    status: "live",
    entryCount: 820,
    lockInDays: 3,
    predictions: [
      {
        id: "p1",
        question: "First Baron",
        optionA: "T1",
        optionB: "Gen.G",
        optionAProbability: 55,
        optionBProbability: 45,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
  {
    id: "seed-btc-target",
    title: "BTC above $100K by Friday?",
    category: "Crypto",
    status: "live",
    entryCount: 60,
    lockInDays: 4,
    predictions: [
      {
        id: "p1",
        question: "BTC close Friday",
        optionA: "Over $100,000",
        optionB: "Under $100,000",
        optionAProbability: 38,
        optionBProbability: 62,
        predictionType: "over_under",
        overUnderLine: 100000,
      },
    ],
  },
  {
    id: "seed-nfl-locked",
    title: "Sunday Night Football — Locked",
    category: "NFL",
    status: "locked",
    entryCount: 8800,
    lockInDays: -0.1,
    predictions: [
      {
        id: "p1",
        question: "Game winner",
        optionA: "Chiefs",
        optionB: "Bills",
        optionAProbability: 53,
        optionBProbability: 47,
        predictionType: "binary",
        overUnderLine: null,
      },
    ],
  },
];

async function run() {
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
