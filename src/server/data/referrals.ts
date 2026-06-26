import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type ReferralDoc,
  type UserDoc,
} from "@/lib/firebase/types";

export interface ReferralRow {
  username: string;
  status: "signed_up" | "converted";
  rewardCents: number;
  rewardCoins: number;
}

export interface ReferralDashboard {
  /** Referral code = the user's username. */
  code: string;
  totalReferred: number;
  converted: number;
  earningsCents: number;
  earningsCoins: number;
  referrals: ReferralRow[];
}

/** Aggregate a user's referral code, stats, and list of referred users. */
export async function fetchReferralDashboard(
  db: Firestore,
  uid: string,
): Promise<ReferralDashboard> {
  const [userSnap, refSnap] = await Promise.all([
    db.collection(COLLECTIONS.users).doc(uid).get(),
    db
      .collection(COLLECTIONS.referrals)
      .where("referrerUid", "==", uid)
      .get(),
  ]);

  const user = userSnap.data() as UserDoc | undefined;

  const referrals: ReferralRow[] = refSnap.docs.map((d) => {
    const r = d.data() as ReferralDoc;
    return {
      username: r.referredUsername,
      status: r.status,
      rewardCents: r.rewardCents,
      rewardCoins: r.rewardCoins,
    };
  });

  const converted = referrals.filter((r) => r.status === "converted").length;
  const earningsCoins = referrals.reduce((n, r) => n + r.rewardCoins, 0);

  return {
    code: user?.username ?? "",
    totalReferred: referrals.length,
    converted,
    earningsCents: user?.referralEarningsCents ?? 0,
    earningsCoins,
    referrals,
  };
}
