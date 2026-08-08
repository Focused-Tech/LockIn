/**
 * Bootstrap the keyholder/keymaster role state on an account (Admin SDK — same mechanism the
 * setKeyholder/setKeymaster actions use). keymaster implies keyholder, mirroring the action.
 * Usage:  node --env-file=.env.local scripts/set-keyholder.mjs <email>
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) { console.error("Usage: node --env-file=.env.local scripts/set-keyholder.mjs <email>"); process.exit(1); }

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) { console.error("Missing FIREBASE_* env"); process.exit(1); }
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

const auth = getAuth();
const db = getFirestore();
const user = await auth.getUserByEmail(email).catch((e) => { console.error(e.message); process.exit(1); });

const ref = db.collection("users").doc(user.uid);
await ref.set({ keyholder: true, keymaster: true, keymasterUid: null }, { merge: true });
const after = (await ref.get()).data();
console.log(JSON.stringify({ email, uid: user.uid, username: after.username, keyholder: after.keyholder === true, keymaster: after.keymaster === true, isAdmin: after.isAdmin === true }, null, 2));
