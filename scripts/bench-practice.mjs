/**
 * Bench the practice-arena data reads that caching changes. Creates a throwaway
 * contest with a realistic leaderboard, measures the SHARED read (contest doc +
 * all entries — what every request paid before caching) vs the residual per-user
 * read (the single "my entry" doc — all that's left on a warm cache hit), then
 * cleans up. Run: node --env-file=.env.local scripts/bench-practice.mjs
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_* env (use --env-file=.env.local)");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const ENTRIES = 40;
const ITERS = 20;
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = async (fn) => { const t = process.hrtime.bigint(); await fn(); return Number(process.hrtime.bigint() - t) / 1e6; };

const cid = `_bench_${Date.now()}`;
const ref = db.collection("practiceContests").doc(cid);
const BENCH_UID = "_bench_uid_0";

async function seed() {
  const legs = Array.from({ length: 5 }, (_, i) => ({
    id: `g${i}`, question: `Bench leg ${i}?`, optionA: "A", optionB: "B",
    probA: 55, probB: 45, type: "binary", line: null, difficulty: "medium",
  }));
  await ref.set({
    hostId: BENCH_UID, hostUsername: "benchbot", title: "Bench", category: "NBA",
    inviteCode: "BENCH1", status: "open", mode: "ai", tier: "rookie", stakeCoins: 50,
    legs, outcomes: ["a", "a", "b", "a", "b"], entryCount: ENTRIES,
    urgencyStartAt: Date.now(), urgencyLockAt: Date.now() + 75000,
    createdAt: FieldValue.serverTimestamp(),
  });
  for (let s = 0; s < ENTRIES; s += 450) {
    const batch = db.batch();
    for (let i = s; i < Math.min(s + 450, ENTRIES); i++) {
      batch.set(ref.collection("practiceEntries").doc(i === 0 ? BENCH_UID : `u${i}`), {
        userId: `u${i}`, username: `player${i}`, tier: "rookie",
        picks: ["a", "b", "a", "a", "b"], correct: i % 6, score: i % 6,
        netCoins: (i % 6) * 10 - 50, won: i % 6 >= 3, submittedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

async function cleanup() {
  const es = await ref.collection("practiceEntries").get();
  for (let s = 0; s < es.docs.length; s += 450) {
    const batch = db.batch();
    es.docs.slice(s, s + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await ref.delete();
}

(async () => {
  await seed();
  // warmup
  await ref.get(); await ref.collection("practiceEntries").get();

  const shared = [], mine = [], home = [];
  for (let i = 0; i < ITERS; i++) {
    shared.push(await ms(async () => { await ref.get(); await ref.collection("practiceEntries").get(); }));
    mine.push(await ms(async () => { await ref.collection("practiceEntries").doc(BENCH_UID).get(); }));
    home.push(await ms(async () => { await db.collection("practiceContests").where("hostId", "==", BENCH_UID).get(); }));
  }

  console.log(`\nPractice data-fetch latency (real Firestore, ${ENTRIES} entries, n=${ITERS}, median ms):`);
  console.log(`  Contest SHARED read (doc + all entries)  [uncached, every request]: ${median(shared).toFixed(0)} ms`);
  console.log(`  Contest MINE read (single entry doc)      [warm: only read left]:   ${median(mine).toFixed(0)} ms`);
  console.log(`  Home HOSTED query (where hostId == uid)   [uncached, every request]: ${median(home).toFixed(0)} ms`);
  console.log(`  → warm cache hit serves SHARED + HOSTED from memory (~<1ms); only MINE re-reads.`);

  await cleanup();
  console.log("\ncleaned up.\n");
  process.exit(0);
})().catch((e) => { console.error(e); cleanup().finally(() => process.exit(1)); });
