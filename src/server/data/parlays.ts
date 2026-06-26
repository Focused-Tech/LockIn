import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type CrossParlayDoc,
  type CrossParlayPickStatus,
  type CrossParlayStatus,
} from "@/lib/firebase/types";

export interface ParlayPickView {
  slateTitle: string;
  question: string;
  pickLabel: string;
  status: CrossParlayPickStatus;
}

export interface ParlayView {
  id: string;
  status: CrossParlayStatus;
  isPaid: boolean;
  entryTier: number;
  parlayMultiplier: number;
  totalScore: number | null;
  rank: number | null;
  payoutCents: number | null;
  payoutCoins: number | null;
  refunded: boolean;
  submittedAtMs: number;
  resolvedCount: number;
  picks: ParlayPickView[];
}

/** A user's cross-slate parlays, newest first, as serializable DTOs. */
export async function fetchUserParlays(
  db: Firestore,
  uid: string,
): Promise<ParlayView[]> {
  // Equality-only query (no composite index); sort in memory.
  const snap = await db
    .collection(COLLECTIONS.crossParlays)
    .where("userId", "==", uid)
    .limit(100)
    .get();

  return snap.docs
    .map((d) => {
      const p = d.data() as CrossParlayDoc;
      return {
        id: d.id,
        status: p.status,
        isPaid: p.isPaid,
        entryTier: p.entryTier,
        parlayMultiplier: p.parlayMultiplier,
        totalScore: p.totalScore,
        rank: p.rank,
        payoutCents: p.payoutCents,
        payoutCoins: p.payoutCoins,
        refunded: p.refunded,
        submittedAtMs: p.submittedAt?.toMillis?.() ?? 0,
        resolvedCount: p.picks.filter((pk) => pk.status !== "pending").length,
        picks: p.picks.map((pk) => ({
          slateTitle: pk.slateTitle,
          question: pk.question,
          pickLabel: pk.pickLabel,
          status: pk.status,
        })),
      };
    })
    .sort((a, b) => b.submittedAtMs - a.submittedAtMs);
}
