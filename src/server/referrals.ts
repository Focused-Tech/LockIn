import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { REFERRAL_PAID_BONUS_CENTS } from "@/lib/constants";

/**
 * Pay the referral cash bonus once a referred user becomes a paid user (first
 * successful deposit). Idempotent via the `referralRewarded` flag — safe to call
 * on every deposit. Credits the referrer's cash balance + referral earnings,
 * marks the referral converted, and writes a `referral` ledger entry (so it
 * shows on the referrer's creator dashboard).
 */
export async function maybeRewardReferral(
  db: Firestore,
  referredUid: string,
): Promise<void> {
  const userRef = db.collection(COLLECTIONS.users).doc(referredUid);
  const snap = await userRef.get();
  const user = snap.data() as UserDoc | undefined;
  if (!user || !user.referredBy || user.referralRewarded) return;

  await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(userRef);
    const fresh = freshSnap.data() as UserDoc | undefined;
    if (!fresh || !fresh.referredBy || fresh.referralRewarded) return;

    const referrerUid = fresh.referredBy;
    const bonus = REFERRAL_PAID_BONUS_CENTS;

    tx.set(userRef, { referralRewarded: true }, { merge: true });
    tx.set(
      db.collection(COLLECTIONS.users).doc(referrerUid),
      {
        cashBalanceCents: FieldValue.increment(bonus),
        referralEarningsCents: FieldValue.increment(bonus),
      },
      { merge: true },
    );
    tx.set(
      db.collection(COLLECTIONS.referrals).doc(referredUid),
      {
        status: "converted",
        convertedAt: FieldValue.serverTimestamp(),
        rewardCents: bonus,
      },
      { merge: true },
    );
    tx.set(
      db.collection(COLLECTIONS.creatorEarnings).doc(`referral_${referredUid}`),
      {
        creatorId: referrerUid,
        slateId: null,
        earningType: "referral",
        grossCents: bonus,
        platformCutCents: 0,
        creatorNetCents: bonus,
        createdAt: FieldValue.serverTimestamp(),
      },
    );
  });
}
