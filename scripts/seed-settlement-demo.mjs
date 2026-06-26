/**
 * Seed a real-money-style contest ready for an end-to-end settlement dry-run.
 *
 * Usage (Admin creds required):
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *     npm run seed:settlement-demo
 *
 * Creates slate `seed-demo-settlement` (hosted by seed-creator-01, run
 * `npm run seed:creators` first), status `locked` with lockTime in the past, plus
 * a realistic field of paid ($5/$10/$25) and free entries. The two predictions
 * are Crypto over/unders with trivially-true lines ("BTC over $1"), so the REAL
 * CoinGecko verifier resolves them and the slate AUTO-SETTLES.
 *
 * Then trigger settlement (the real orchestrator):
 *   curl -X POST "$APP_URL/api/admin/settle" \
 *     -H "Authorization: Bearer $ADMIN_SETTLE_SECRET" \
 *     -H "content-type: application/json" -d '{"slateId":"seed-demo-settlement"}'
 * or wait for the 5-min cron. Confirm payouts in entrant balances + the creator's
 * hosting earnings, or — if you change the lines so a source can't resolve —
 * watch it land in /admin/settlements for manual review.
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

const SLATE_ID = "seed-demo-settlement";
const HOST = "seed-creator-01";
const now = Date.now();
const past = Timestamp.fromMillis(now - 60 * 60 * 1000); // lock time 1h ago

const PREDICTIONS = [
  { id: "p1", question: "Will BTC be over $1?", line: 1 },
  { id: "p2", question: "Will ETH be over $1?", line: 1 },
];

// Tiers: all ≥ MIN_PARTICIPANTS (20) so every paid pool pays out.
const TIERS = [
  { tier: 5, hostingFeeCents: 100, paid: 60 },
  { tier: 10, hostingFeeCents: 200, paid: 30 },
  { tier: 25, hostingFeeCents: 300, paid: 22 },
];
const FREE_COUNT = 40;

async function run() {
  const slateRef = db.collection("slates").doc(SLATE_ID);
  const batch = db.batch();

  let entryCount = 0;
  const addEntry = (tier, hostingFeeCents, isPaid, idx) => {
    const uid = `seed-en-${isPaid ? `p${tier}` : "free"}-${String(idx).padStart(3, "0")}`;
    const correct = idx % 3; // 0..2 of 2 predictions correct → score spread
    const picks = PREDICTIONS.map((p, j) => ({
      predictionId: p.id,
      choice: j < correct ? "a" : "b", // "a" = Over = correct
    }));
    batch.set(slateRef.collection("entries").doc(uid), {
      userId: uid,
      entryTier: tier,
      hostingFeeCents,
      isPaid,
      coinCost: isPaid ? null : 100,
      picks,
      score: null,
      rank: null,
      payoutCents: null,
      payoutCoins: null,
      refunded: false,
      submittedAt: Timestamp.fromMillis(now - 2 * 60 * 60 * 1000 + idx * 1000),
    });
    entryCount += 1;
  };

  TIERS.forEach((t) => {
    for (let i = 0; i < t.paid; i++) addEntry(t.tier, t.hostingFeeCents, true, i);
  });
  for (let i = 0; i < FREE_COUNT; i++) addEntry(5, 0, false, i);

  batch.set(slateRef, {
    creatorId: HOST,
    title: "Crypto Close — BTC & ETH",
    description: "Demo settlement slate.",
    category: "Crypto",
    status: "locked",
    entryTiers: TIERS.map((t) => ({ tier: t.tier, hostingFeeCents: t.hostingFeeCents })),
    entryCount,
    isCardRush: false,
    rushMultiplier: 1,
    maxEntries: null,
    lockTime: past,
    promotionOpensAt: past,
    settledAt: null,
    cancelledAt: null,
    creatorBonusCents: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  PREDICTIONS.forEach((p, i) => {
    batch.set(slateRef.collection("predictions").doc(p.id), {
      question: p.question,
      optionA: `Over ${p.line}`,
      optionB: `Under ${p.line}`,
      optionAProbability: 95,
      optionBProbability: 5,
      optionAMultiplier: 1.05,
      optionBMultiplier: 20,
      predictionType: "over_under",
      overUnderLine: p.line,
      result: null,
      verificationSources: null,
      verificationConfidence: null,
      sortOrder: i,
    });
  });

  await batch.commit();
  console.log(
    `Seeded slate ${SLATE_ID} (host ${HOST}) — ${entryCount} entries, status locked, lockTime past.\n` +
      `Trigger: POST /api/admin/settle {"slateId":"${SLATE_ID}"} (or wait for cron).`,
  );
}

run().then(() => process.exit(0));
