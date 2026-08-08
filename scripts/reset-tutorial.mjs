/**
 * Reset a user's tutorial seen-records so the Locksmith screen re-fires (verification only).
 * Usage:  node --env-file=.env.local scripts/reset-tutorial.mjs <email>
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) { console.error("Usage: node --env-file=.env.local scripts/reset-tutorial.mjs <email>"); process.exit(1); }

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) { console.error("Missing FIREBASE_* env"); process.exit(1); }
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db = getFirestore();
const user = await auth.getUserByEmail(email).catch((e) => { console.error(e.message); process.exit(1); });

const col = db.collection("users").doc(user.uid).collection("tutorials");
const snap = await col.get();
let n = 0;
for (const d of snap.docs) { await d.ref.delete(); n++; }
console.log(JSON.stringify({ email, uid: user.uid, tutorialDocsDeleted: n }, null, 2));
