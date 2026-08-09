import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/config";
import { COLLECTIONS, type EnrolmentKeyDoc, type UserDoc } from "@/lib/firebase/types";
import { DEPOSIT_LIMITS, SIGNUP_BONUS_COINS } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * KEY SIGN-IN redemption (Part 3 D). Verifies an enrolment key + the caller's Firebase sign-in, then
 * turns them INTO a keyholder in the issuing keymaster's tree and issues the referral code (= their
 * username). SERVER-ENFORCED guards: grants KEYHOLDER only + the upline — NEVER admin, NEVER
 * keymaster. SINGLE-USE: the key is burned in the same transaction, so a redeemed/expired/revoked key
 * is dead. An invalid key fails with a plain message and reveals NOTHING about any tree.
 */
function dead() {
  return NextResponse.json({ error: "That key can't be used." }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { idToken?: string; code?: string; username?: string };
  if (!body.idToken || !body.code) return dead();

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken);
    uid = decoded.uid;
    email = decoded.email ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid sign-in" }, { status: 401 });
  }

  const db = adminDb();
  const code = body.code.trim().toUpperCase();
  const username = (body.username ?? "").trim();

  // Resolve the key ref (outside the txn), then verify + burn it atomically INSIDE the txn.
  const found = await db.collection(COLLECTIONS.enrolmentKeys).where("code", "==", code).limit(1).get();
  if (found.empty) return dead(); // reveal nothing
  const keyRef = found.docs[0]!.ref;
  const userRef = db.collection(COLLECTIONS.users).doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const kSnap = await tx.get(keyRef);
      const k = kSnap.data() as EnrolmentKeyDoc | undefined;
      if (!k || k.status !== "unused") throw new Error("KEY_DEAD");
      if (k.expiresAt && k.expiresAt.toMillis() < Date.now()) throw new Error("KEY_DEAD");

      const uSnap = await tx.get(userRef);
      let resolvedUsername = username;

      if (uSnap.exists) {
        // EXISTING account → attach the keyholder role + the tree upline. Never admin/keymaster.
        resolvedUsername = (uSnap.data() as UserDoc).username;
        tx.set(userRef, { keyholder: true, keymasterUid: k.keymasterUid }, { merge: true });
      } else {
        // NEW account → a minimal profile (NOT the consumer signup flow). Referral code = username.
        if (!resolvedUsername || resolvedUsername.length < 3) throw new Error("USERNAME_REQUIRED");
        const nameRef = db.collection(COLLECTIONS.usernames).doc(resolvedUsername.toLowerCase());
        const nameSnap = await tx.get(nameRef);
        if (nameSnap.exists) throw new Error("USERNAME_TAKEN");
        tx.set(nameRef, { uid });
        tx.set(userRef, {
          username: resolvedUsername,
          email,
          dateOfBirth: "",
          avatarUrl: null,
          coinBalance: SIGNUP_BONUS_COINS,
          cashBalanceCents: 0,
          kycStatus: "none",
          kycProviderId: null,
          kycVerifiedAt: null,
          geoState: null,
          registeredState: null,
          stripeCustomerId: null,
          isCreator: false,
          creatorVerified: false,
          creatorTier: "basic",
          creatorStripeConnectId: null,
          creatorPayoutsEnabled: false,
          proSubscriber: false,
          proExpiresAt: null,
          stripeSubscriptionId: null,
          depositLimitDailyCents: DEPOSIT_LIMITS.dailyCents,
          depositLimitWeeklyCents: DEPOSIT_LIMITS.weeklyCents,
          depositLimitMonthlyCents: DEPOSIT_LIMITS.monthlyCents,
          selfExclusionUntil: null,
          categories: [],
          followedCreators: [],
          deviceTokens: [],
          referredBy: null,
          referralRewarded: false,
          referralCount: 0,
          referralEarningsCents: 0,
          keyholder: true,
          keymasterUid: k.keymasterUid,
          keyholderUid: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Burn the key — SINGLE USE.
      tx.set(
        keyRef,
        { status: "redeemed", redeemedByUid: uid, redeemedByUsername: resolvedUsername, redeemedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "USERNAME_TAKEN") return NextResponse.json({ error: "That username is taken", code: "USERNAME_TAKEN" }, { status: 409 });
    if (m === "USERNAME_REQUIRED") return NextResponse.json({ error: "Choose a username (3+ characters)" }, { status: 400 });
    return dead(); // KEY_DEAD (used / expired / revoked) and anything else → plain, reveal nothing
  }

  const sessionCookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE_MS });
  const res = NextResponse.json({ ok: true, redirect: "/app/keyholder" });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return res;
}
