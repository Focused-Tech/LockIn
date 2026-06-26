/**
 * TEARDOWN for the beginner-journey demo seed (inverse of seed-beginner.mjs).
 *
 * Removes exactly what `npm run seed:beginner` wrote:
 *   - the creator-owned demo slates (+ their predictions subcollections)
 *   - the `creatorHitRate` field on the two anchor creators
 *
 * It does NOT delete the creator accounts themselves — those come from
 * `npm run seed:creators` (a separate seed). After this runs, those creators
 * simply own no live slates and drop out of the beginner feed.
 *
 * Usage (Admin creds required):
 *   FIREBASE_PROJECT_ID=... FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY="..." \
 *     npm run unseed:beginner
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

// Must match the ids written by seed-beginner.mjs.
const SLATE_IDS = ["seed-beg-nba", "seed-beg-crypto"];
const CREATOR_IDS = ["seed-creator-01", "seed-creator-05"];

async function run() {
  let removedSlates = 0;
  let removedPreds = 0;

  for (const id of SLATE_IDS) {
    const slateRef = db.collection("slates").doc(id);
    const preds = await slateRef.collection("predictions").get();
    for (const p of preds.docs) {
      await p.ref.delete();
      removedPreds++;
    }
    const snap = await slateRef.get();
    if (snap.exists) {
      await slateRef.delete();
      removedSlates++;
    }
    console.log(`removed ${id} (${preds.size} predictions)`);
  }

  for (const uid of CREATOR_IDS) {
    await db
      .collection("users")
      .doc(uid)
      .set({ creatorHitRate: FieldValue.delete() }, { merge: true });
    console.log(`cleared creatorHitRate on ${uid}`);
  }

  console.log(
    `Done — removed ${removedSlates} slates, ${removedPreds} predictions; cleared ${CREATOR_IDS.length} hit-rates.`,
  );
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
