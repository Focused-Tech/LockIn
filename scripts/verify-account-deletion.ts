/**
 * ONE-OFF VERIFICATION — Henry handoff assignment 2, Frank's v2 demand: terminal proof the data is
 * actually destroyed, run against the Firebase EMULATOR (never production). Seeds a clean test
 * account with no deletion blockers, runs the REAL deleteAccount() from src/server/account/deletion.ts
 * unmodified, then re-reads everything to confirm it's gone.
 *
 * Run: firebase emulators:exec --only auth,firestore --project lockin-verify \
 *        "NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-account-deletion.ts"
 */
import { execSync } from "node:child_process";

process.env.FIREBASE_PROJECT_ID ??= "lockin-verify";
process.env.FIREBASE_CLIENT_EMAIL ??= "test@lockin-verify.iam.gserviceaccount.com";
// A throwaway, locally-generated key — needs to be PEM-shaped for firebase-admin's cert() parser to
// accept it, but it is never checked against real Google servers: FIRESTORE_EMULATOR_HOST /
// FIREBASE_AUTH_EMULATOR_HOST (set by the caller) route every call to the local emulator instead.
process.env.FIREBASE_PRIVATE_KEY ??= execSync("openssl genrsa 2048 2>/dev/null").toString();

import { adminAuth, adminDb } from "../src/lib/firebase/admin";
import { COLLECTIONS } from "../src/lib/firebase/types";
import { deleteAccount } from "../src/server/account/deletion";

async function main() {
  const db = adminDb();
  const auth = adminAuth();

  const email = `deletion-proof-${Date.now()}@example.com`;
  const username = `proofuser${Date.now()}`;
  const usernameLower = username.toLowerCase();

  console.log("── SEEDING a clean test account ──");
  const authUser = await auth.createUser({ email, password: "correct horse battery staple" });
  const uid = authUser.uid;
  console.log("Auth user created:", uid);

  await db.collection(COLLECTIONS.users).doc(uid).set({
    username,
    email,
    kycStatus: "verified",
    coinBalance: 500,
    cashBalanceCents: 0, // must be 0 — a nonzero balance is a deletion blocker by design
    isCreator: false,
    deviceTokens: ["fcm-token-abc123"],
    createdAt: new Date(),
  });
  console.log("users/{uid} doc created, with a non-empty deviceTokens array");

  await db.collection(COLLECTIONS.usernames).doc(usernameLower).set({ uid });
  console.log(`usernames/${usernameLower} reservation created`);

  console.log("\n── BEFORE deletion ──");
  console.log("Auth user exists:", !!(await auth.getUser(uid).catch(() => null)));
  console.log("users/{uid} exists:", (await db.collection(COLLECTIONS.users).doc(uid).get()).exists);
  console.log("usernames/{lower} exists:", (await db.collection(COLLECTIONS.usernames).doc(usernameLower).get()).exists);

  console.log("\n── RUNNING deleteAccount(uid) — the real function, unmodified ──");
  const receipt = await deleteAccount(uid);
  console.log("Receipt:", JSON.stringify(receipt, null, 2));

  console.log("\n── AFTER deletion ──");
  const authGone = await auth.getUser(uid).then(() => false).catch((e) => e.code === "auth/user-not-found");
  const userDocGone = !(await db.collection(COLLECTIONS.users).doc(uid).get()).exists;
  const usernameGone = !(await db.collection(COLLECTIONS.usernames).doc(usernameLower).get()).exists;
  console.log("Auth user deleted:", authGone);
  console.log("users/{uid} doc deleted:", userDocGone);
  console.log("usernames/{lower} reservation released:", usernameGone);
  // deviceTokens lived on the user doc itself (UserDoc.deviceTokens), not a separate collection — its
  // deletion is covered by the users/{uid} doc going, confirmed above.

  const allGone = authGone && userDocGone && usernameGone;
  console.log("\n" + (allGone ? "✅ ALL DATA CONFIRMED GONE" : "❌ SOMETHING SURVIVED — investigate"));
  process.exit(allGone ? 0 : 1);
}

main().catch((e) => {
  console.error("VERIFICATION SCRIPT FAILED:", e);
  process.exit(1);
});
