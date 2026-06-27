/**
 * Grant (or revoke) platform-admin on a user, by email, in the live Firestore.
 *
 * Usage (Admin creds required in env):
 *   node scripts/set-admin.mjs <email> [--revoke]
 *
 * Resolves the email to a uid via Admin Auth, sets users/{uid}.isAdmin, and
 * reads the doc back to confirm. This is the single source of truth for the
 * /admin dashboard gate (src/lib/firebase/session.ts → isAdminUid).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!email) {
  console.error("Usage: node scripts/set-admin.mjs <email> [--revoke]");
  process.exit(1);
}

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

const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email).catch((e) => {
  console.error(`Could not find an auth user for ${email}:`, e.message);
  process.exit(1);
});

const ref = db.collection("users").doc(user.uid);
const before = await ref.get();
if (!before.exists) {
  console.error(`No users/${user.uid} profile doc exists for ${email}.`);
  process.exit(1);
}

await ref.set({ isAdmin: !revoke }, { merge: true });

const after = (await ref.get()).data();
console.log(
  JSON.stringify(
    {
      email,
      uid: user.uid,
      username: after.username ?? null,
      isAdmin: after.isAdmin === true,
      creatorVerified: after.creatorVerified === true,
      action: revoke ? "revoked" : "granted",
    },
    null,
    2,
  ),
);
