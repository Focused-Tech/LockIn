import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/firebase/config";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { keyholderStampFor, type KeyholderStamp } from "@/lib/keyholder/attribution";
import {
  DEPOSIT_LIMITS,
  REFERRAL_SIGNUP_COINS,
  REFERRED_WELCOME_COINS,
  SIGNUP_BONUS_COINS,
} from "@/lib/constants";
import { signupProfileSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Completes signup after the client has created the Firebase Auth user:
 *  1. verifies the ID token (proves ownership of the new account),
 *  2. transactionally reserves the username + creates the users/{uid} profile
 *     (500-coin signup bonus),
 *  3. mints the session cookie.
 *
 * On a username conflict, returns 409 — the client deletes the orphaned auth
 * user and surfaces the error.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    idToken?: string;
    username?: string;
    dateOfBirth?: string;
    ref?: string;
  };

  if (!body.idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken);
    uid = decoded.uid;
    email = decoded.email ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const parsed = signupProfileSchema.safeParse({
    username: body.username,
    dateOfBirth: body.dateOfBirth,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile" },
      { status: 400 },
    );
  }
  const { username, dateOfBirth } = parsed.data;

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const nameRef = db
    .collection(COLLECTIONS.usernames)
    .doc(username.toLowerCase());

  // Resolve a referral code (the referrer's username) → referrer uid.
  let referrerUid: string | null = null;
  const ref =
    typeof body.ref === "string" ? body.ref.trim().toLowerCase() : "";
  if (ref && ref !== username.toLowerCase()) {
    const refSnap = await db.collection(COLLECTIONS.usernames).doc(ref).get();
    const refUid = refSnap.exists
      ? (refSnap.data() as { uid?: string }).uid
      : undefined;
    if (refUid && refUid !== uid) referrerUid = refUid;
  }
  const welcomeCoins = referrerUid ? REFERRED_WELCOME_COINS : 0;

  // KEYHOLDER FIRST-TOUCH ATTRIBUTION — if the resolved referrer is a keyholder, compute the
  // (immutable) stamp now. Written ONCE inside the create below; never editable thereafter.
  let keyStamp: KeyholderStamp | null = null;
  if (referrerUid) {
    const rSnap = await db.collection(COLLECTIONS.users).doc(referrerUid).get();
    const r = rSnap.data() as UserDoc | undefined;
    keyStamp = keyholderStampFor(r ? { uid: referrerUid, keyholder: r.keyholder, keymasterUid: r.keymasterUid } : null);
  }

  try {
    await db.runTransaction(async (tx) => {
      const [nameSnap, userSnap] = await Promise.all([
        tx.get(nameRef),
        tx.get(userRef),
      ]);
      if (nameSnap.exists) throw new Error("USERNAME_TAKEN");
      if (userSnap.exists) throw new Error("PROFILE_EXISTS");

      tx.set(nameRef, { uid });
      tx.set(userRef, {
        username,
        email,
        dateOfBirth,
        avatarUrl: null,
        coinBalance: SIGNUP_BONUS_COINS + welcomeCoins,
        cashBalanceCents: 0,
        kycStatus: "unverified",
        kycProvider: null,
        kycReferenceId: null,
        kycVerifiedDob: null,
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
        referredBy: referrerUid,
        referralRewarded: false,
        referralCount: 0,
        referralEarningsCents: 0,
        // First-touch keyholder attribution (null unless referred by a keyholder). Immutable.
        keyholderUid: keyStamp?.keyholderUid ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Keyholder attribution index — one doc per referred account, typed later by its first
      // qualifying event. Created once, alongside the account.
      if (keyStamp) {
        tx.set(db.collection(COLLECTIONS.keyholderReferrals).doc(uid), {
          keyholderUid: keyStamp.keyholderUid,
          keymasterUid: keyStamp.keymasterUid,
          referredUid: uid,
          referredUsername: username,
          type: null,
          createdAt: FieldValue.serverTimestamp(),
          typedAt: null,
        });
      }

      // Reward the referrer (coins now; cash on the referred user's first deposit).
      if (referrerUid) {
        tx.set(db.collection(COLLECTIONS.referrals).doc(uid), {
          referrerUid,
          referredUid: uid,
          referredUsername: username,
          status: "signed_up",
          rewardCoins: REFERRAL_SIGNUP_COINS,
          rewardCents: 0,
          signupAt: FieldValue.serverTimestamp(),
          convertedAt: null,
        });
        tx.set(
          db.collection(COLLECTIONS.users).doc(referrerUid),
          {
            coinBalance: FieldValue.increment(REFERRAL_SIGNUP_COINS),
            referralCount: FieldValue.increment(1),
          },
          { merge: true },
        );
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "USERNAME_TAKEN") {
      return NextResponse.json(
        { error: "That username is already taken", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    if (message === "PROFILE_EXISTS") {
      return NextResponse.json({ ok: true }); // idempotent: already created
    }
    return NextResponse.json(
      { error: "Could not create your profile" },
      { status: 500 },
    );
  }

  const sessionCookie = await adminAuth().createSessionCookie(body.idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return res;
}
