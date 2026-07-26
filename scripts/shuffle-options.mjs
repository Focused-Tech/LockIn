// Fix answer-position bias in the ACTIVE pool: Fisher-Yates each question's options, move correctIndex
// with the correct answer. No model calls — just rewrites options + correctIndex on existing docs.
import admin from "firebase-admin";
import { readFileSync } from "fs";
const ENV = readFileSync("C:/lockin/.env.local", "utf8");
const val = (k) => { const m = ENV.match(new RegExp(`^#?\\s*${k}\\s*=\\s*"?([^\\n"]+)`, "m")); return m ? m[1].trim() : null; };
admin.initializeApp({ credential: admin.credential.cert({ projectId: val("FIREBASE_PROJECT_ID"), clientEmail: val("FIREBASE_CLIENT_EMAIL"), privateKey: (val("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n") }) });
const db = admin.firestore();

const active = (await db.collection("triviaBatches").where("status", "==", "active").limit(1).get()).docs[0].data();
const docs = (await db.collection("triviaQuestions").where("batchId", "==", active.batchId).get()).docs;

let n = 0;
for (let i = 0; i < docs.length; i += 400) {
  const batch = db.batch();
  for (const d of docs.slice(i, i + 400)) {
    const q = d.data();
    if (!Array.isArray(q.options) || q.options.length < 2) continue;
    const tagged = q.options.map((o, idx) => ({ o, correct: idx === q.correctIndex }));
    for (let j = tagged.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [tagged[j], tagged[k]] = [tagged[k], tagged[j]]; }
    batch.update(d.ref, { options: tagged.map((t) => t.o), correctIndex: tagged.findIndex((t) => t.correct) });
    n++;
  }
  await batch.commit();
}
console.log(`shuffled ${n} questions in batch ${active.batchId}`);
process.exit(0);
