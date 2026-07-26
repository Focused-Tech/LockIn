// Verify the Fox Pit deal path end-to-end WITHOUT the app: run fetchTriviaForRound's exact query
// (batchId == · tier == · category in [...]) at every tier — proves the pool + the new composite index.
import admin from "firebase-admin";
import { readFileSync } from "fs";

const ENV = readFileSync("C:/lockin/.env.local", "utf8");
const val = (k) => {
  const m = ENV.match(new RegExp(`^#?\\s*${k}\\s*=\\s*"?([^\\n"]+)`, "m"));
  return m ? m[1].trim() : null;
};
const FB_KEY = (val("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
admin.initializeApp({
  credential: admin.credential.cert({ projectId: val("FIREBASE_PROJECT_ID"), clientEmail: val("FIREBASE_CLIENT_EMAIL"), privateKey: FB_KEY }),
});
const db = admin.firestore();

const active = (await db.collection("triviaBatches").where("status", "==", "active").limit(1).get()).docs[0]?.data();
console.log("active batch:", active?.batchId, "| questionCount:", active?.questionCount);

// A few tower categories → their taxonomy labels (mirrors triviaLabelsForCategory).
const CASES = {
  sports: ["Sports \u00b7 NBA", "Sports \u00b7 NFL", "Sports \u00b7 boxing/UFC", "Sports \u00b7 college hoops", "Sports \u00b7 big televised moments"],
  crypto: ["Crypto \u00b7 Bitcoin & crypto milestones"],
  weather: ["Weather \u00b7 record storms & weather history"],
};
for (const tier of ["dojo", "coliseum", "hightable", "suite"]) {
  for (const [cat, labels] of Object.entries(CASES)) {
    const snap = await db.collection("triviaQuestions")
      .where("batchId", "==", active.batchId).where("tier", "==", tier)
      .where("category", "in", labels).get();
    const ex = snap.docs[0]?.data();
    console.log(`  ${tier}/${cat}: ${snap.size} Qs${ex ? ` | e.g. "${ex.question.slice(0, 54)}…" [${ex.options.length} opts, ✓#${ex.correctIndex}]` : ""}`);
  }
}
process.exit(0);
