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

export const runtime = "nodejs";

/**
 * Completes a SOCIAL sign-in (Google / Apple) after the client obtained a
 * Firebase ID token via the provider. Mirrors /api/auth/signup but derives the
 * profile from the provider identity (no username/DOB form):
 *  - existing profile  → refresh email/avatar, mint cookie, isNewUser=false
 *  - no profile        → create one with a unique auto-derived username (500-coin
 *                        bonus, optional referral), mint cookie, isNewUser=true
 *
 * DOB is left empty (providers don't supply it); age/identity is captured later
 * in onboarding/KYC, exactly as for a free email account.
 */

/** Reduce a display name / email local-part to a valid username seed. */
function usernameSeed(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const base = cleaned.slice(0, 16);
  return base.length >= 3 ? base : `player${base}`;
}

function randomSuffix(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    idToken?: string;
    displayName?: string | null;
    photoURL?: string | null;
    ref?: string;
  };
  if (!body.idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let uid: string;
  let email: string;
  let tokenName: string;
  let tokenPicture: string | null;
  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken);
    uid = decoded.uid;
    email = decoded.email ?? "";
    tokenName = (decoded.name as string | undefined) ?? "";
    tokenPicture = (decoded.picture as string | undefined) ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const displayName = (body.displayName ?? tokenName ?? "").trim();
  const photoURL = body.photoURL ?? tokenPicture ?? null;

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const existing = await userRef.get();

  let isNewUser = false;

  if (existing.exists) {
    // Merge fresh provider data without clobbering the chosen username.
    const cur = existing.data() as UserDoc;
    const patch: Record<string, unknown> = {};
    if (email && cur.email !== email) patch.email = email;
    if (photoURL && !cur.avatarUrl) patch.avatarUrl = photoURL;
    if (Object.keys(patch).length) await userRef.set(patch, { merge: true });
  } else {
    isNewUser = true;

    // Resolve an optional referral code (referrer's username) → referrer uid.
    let referrerUid: string | null = null;
    const ref =
      typeof body.ref === "string" ? body.ref.trim().toLowerCase() : "";
    if (ref) {
      const refSnap = await db.collection(COLLECTIONS.usernames).doc(ref).get();
      const refUid = refSnap.exists
        ? (refSnap.data() as { uid?: string }).uid
        : undefined;
      if (refUid && refUid !== uid) referrerUid = refUid;
    }
    const welcomeCoins = referrerUid ? REFERRED_WELCOME_COINS : 0;

    // KEYHOLDER FIRST-TOUCH ATTRIBUTION — immutable stamp when the referrer is a keyholder.
    let keyStamp: KeyholderStamp | null = null;
    if (referrerUid) {
      const rSnap = await db.collection(COLLECTIONS.users).doc(referrerUid).get();
      const r = rSnap.data() as UserDoc | undefined;
      keyStamp = keyholderStampFor(r ? { uid: referrerUid, keyholder: r.keyholder, keymasterUid: r.keymasterUid } : null);
    }
    const seed = usernameSeed(displayName || email.split("@")[0] || "player");

    let created = false;
    for (let attempt = 0; attempt < 6 && !created; attempt++) {
      const candidate =
        attempt === 0 ? seed : `${seed.slice(0, 14)}${randomSuffix()}`;
      const nameRef = db
        .collection(COLLECTIONS.usernames)
        .doc(candidate.toLowerCase());
      try {
        await db.runTransaction(async (tx) => {
          const [nameSnap, userSnap] = await Promise.all([
            tx.get(nameRef),
            tx.get(userRef),
          ]);
          if (userSnap.exists) {
            created = true; // raced with another tab — profile already there
            return;
          }
          if (nameSnap.exists) throw new Error("USERNAME_TAKEN");

          tx.set(nameRef, { uid });
          tx.set(userRef, {
            username: candidate,
            email,
            dateOfBirth: "", // not provided by social IdP; captured in KYC later
            avatarUrl: photoURL,
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

          if (keyStamp) {
            tx.set(db.collection(COLLECTIONS.keyholderReferrals).doc(uid), {
              keyholderUid: keyStamp.keyholderUid,
              keymasterUid: keyStamp.keymasterUid,
              referredUid: uid,
              referredUsername: candidate,
              type: null,
              createdAt: FieldValue.serverTimestamp(),
              typedAt: null,
            });
          }

          if (referrerUid) {
            tx.set(db.collection(COLLECTIONS.referrals).doc(uid), {
              referrerUid,
              referredUid: uid,
              referredUsername: candidate,
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
          created = true;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "USERNAME_TAKEN") continue;
        return NextResponse.json(
          { error: "Could not create your profile" },
          { status: 500 },
        );
      }
    }
    if (!created) {
      return NextResponse.json(
        { error: "Could not assign a username — try again" },
        { status: 500 },
      );
    }
  }

  const sessionCookie = await adminAuth().createSessionCookie(body.idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  const res = NextResponse.json({ ok: true, isNewUser });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return res;
}
