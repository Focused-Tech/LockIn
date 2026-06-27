/**
 * Provision the platform OWNER profile (one-off), then grant admin + creator.
 *
 * Usage (Admin creds in env):
 *   node scripts/provision-owner.mjs <email> <username>
 *
 * The account already exists in Firebase Auth but has no users/{uid} profile
 * (signup was never completed). This creates a complete profile matching the
 * signup defaults, reserves the username, and sets isAdmin + creatorVerified.
 * Idempotent: if the profile already exists it only flips the admin/creator
 * flags. Mirrors src/app/api/auth/signup/route.ts.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
const username = process.argv[3];
if (!email || !username) {
  console.error("Usage: node scripts/provision-owner.mjs <email> <username>");
  process.exit(1);
}

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
const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email).catch((e) => {
  console.error(`No auth user for ${email}:`, e.message);
  process.exit(1);
});
const uid = user.uid;
const lower = username.toLowerCase();

const userRef = db.collection("users").doc(uid);
const nameRef = db.collection("usernames").doc(lower);

await db.runTransaction(async (tx) => {
  const [userSnap, nameSnap] = await Promise.all([
    tx.get(userRef),
    tx.get(nameRef),
  ]);

  if (userSnap.exists) {
    // Already provisioned — just ensure owner flags are set.
    tx.set(
      userRef,
      { isAdmin: true, isCreator: true, creatorVerified: true },
      { merge: true },
    );
    return;
  }

  // Username must be free (or already reserved to this uid).
  if (nameSnap.exists && nameSnap.data().uid !== uid) {
    throw new Error(`USERNAME_TAKEN:${username}`);
  }

  tx.set(nameRef, { uid });
  tx.set(userRef, {
    username,
    email,
    dateOfBirth: "1990-01-01", // owner placeholder (of age); editable later
    avatarUrl: null,
    coinBalance: 500,
    cashBalanceCents: 0,
    kycStatus: "none",
    kycProviderId: null,
    kycVerifiedAt: null,
    geoState: null,
    registeredState: null,
    stripeCustomerId: null,
    isAdmin: true,
    isCreator: true,
    creatorVerified: true,
    creatorTier: "basic",
    creatorStripeConnectId: null,
    creatorPayoutsEnabled: false,
    proSubscriber: false,
    proExpiresAt: null,
    stripeSubscriptionId: null,
    depositLimitDailyCents: 500_00,
    depositLimitWeeklyCents: 2000_00,
    depositLimitMonthlyCents: 5000_00,
    selfExclusionUntil: null,
    categories: [],
    hasCompletedTour: false,
    currentTourStep: 0,
    journeyLane: "advanced",
    followedCreators: [],
    deviceTokens: [],
    referredBy: null,
    referralRewarded: false,
    referralCount: 0,
    referralEarningsCents: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
});

const after = (await userRef.get()).data();
console.log(
  JSON.stringify(
    {
      email,
      uid,
      username: after.username,
      isAdmin: after.isAdmin === true,
      isCreator: after.isCreator === true,
      creatorVerified: after.creatorVerified === true,
      coinBalance: after.coinBalance,
    },
    null,
    2,
  ),
);
