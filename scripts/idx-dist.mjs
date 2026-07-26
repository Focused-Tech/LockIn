// Answer-position bias check: distribution of correctIndex across the active pool.
import admin from "firebase-admin";
import { readFileSync } from "fs";
const ENV = readFileSync("C:/lockin/.env.local", "utf8");
const val = (k) => { const m = ENV.match(new RegExp(`^#?\\s*${k}\\s*=\\s*"?([^\\n"]+)`, "m")); return m ? m[1].trim() : null; };
admin.initializeApp({ credential: admin.credential.cert({ projectId: val("FIREBASE_PROJECT_ID"), clientEmail: val("FIREBASE_CLIENT_EMAIL"), privateKey: (val("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n") }) });
const db = admin.firestore();
const active = (await db.collection("triviaBatches").where("status", "==", "active").limit(1).get()).docs[0].data();
const all = await db.collection("triviaQuestions").where("batchId", "==", active.batchId).get();
const dist = [0, 0, 0, 0];
all.forEach((d) => { const c = d.data().correctIndex; if (c >= 0 && c < 4) dist[c]++; });
const tot = dist.reduce((a, b) => a + b, 0);
console.log(`correctIndex distribution over ${tot} questions:`);
dist.forEach((n, i) => console.log(`  ${String.fromCharCode(65 + i)} (#${i}): ${n} (${(100 * n / tot).toFixed(1)}%)`));
process.exit(0);
