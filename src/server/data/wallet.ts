import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type DepositDoc,
  type EntryDoc,
  type FsTimestamp,
  type WithdrawalDoc,
} from "@/lib/firebase/types";
import type { Transaction } from "@/lib/wallet";

const ms = (ts: FsTimestamp | null | undefined): number =>
  ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;

/**
 * Build a unified cash transaction history for a user from deposits,
 * withdrawals, and (paid) contest entries + their winnings. Sorted newest-first.
 * Coins are tracked separately and not included here.
 */
export async function fetchTransactions(
  db: Firestore,
  uid: string,
): Promise<Transaction[]> {
  const [depositsSnap, withdrawalsSnap, entriesSnap] = await Promise.all([
    db.collection(COLLECTIONS.deposits).where("userId", "==", uid).get(),
    db.collection(COLLECTIONS.withdrawals).where("userId", "==", uid).get(),
    db.collectionGroup(COLLECTIONS.entries).where("userId", "==", uid).get(),
  ]);

  const txns: Transaction[] = [];

  for (const doc of depositsSnap.docs) {
    const d = doc.data() as DepositDoc;
    txns.push({
      id: doc.id,
      kind: "deposit",
      description: d.paymentMethod === "ach" ? "Deposit · bank" : "Deposit · card",
      amountCents: d.amountCents,
      status: d.status,
      timestampMs: ms(d.createdAt),
    });
  }

  for (const doc of withdrawalsSnap.docs) {
    const w = doc.data() as WithdrawalDoc;
    txns.push({
      id: doc.id,
      kind: "withdrawal",
      description: "Withdrawal · bank",
      amountCents: -w.amountCents,
      status: w.status,
      timestampMs: ms(w.requestedAt),
    });
  }

  for (const doc of entriesSnap.docs) {
    const e = doc.data() as EntryDoc;
    if (e.isPaid) {
      txns.push({
        id: `${doc.id}-entry`,
        kind: "entry",
        description: "Contest entry",
        amountCents: -(e.entryTier * 100 + e.hostingFeeCents),
        status: "completed",
        timestampMs: ms(e.submittedAt),
      });
    }
    if (e.payoutCents && e.payoutCents > 0) {
      txns.push({
        id: `${doc.id}-win`,
        kind: "winnings",
        description: "Contest winnings",
        amountCents: e.payoutCents,
        status: "paid",
        timestampMs: ms(e.submittedAt),
      });
    }
  }

  return txns.sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 50);
}
