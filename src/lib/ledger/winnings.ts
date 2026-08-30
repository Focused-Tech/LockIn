import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/types";
import { TAX_1099_THRESHOLD_CENTS } from "@/lib/tax/config";

/** Immutable per-contest winnings ledger entry. Never mutated after creation. */
export interface WinningsLedgerDoc {
  userId: string;
  contestId: string;
  grossWinningsCents: number;
  entryFeeCents: number;
  taxYear: number;
}

/** Rolling annual (calendar-year) tax totals per user. */
export interface TaxRollup {
  grossWinningsCents: number;
  entryFeesCents: number;
  netProfitCents: number;
  winCount: number;
  taxReportingRequired: boolean;
}

export const EMPTY_ROLLUP: TaxRollup = {
  grossWinningsCents: 0,
  entryFeesCents: 0,
  netProfitCents: 0,
  winCount: 0,
  taxReportingRequired: false,
};

/**
 * PURE: fold one winning into an annual rollup and re-derive the 1099 flag.
 * netProfit = grossWinnings − entryFees (see LEGAL/TAX assumptions in tax/config).
 */
export function applyWinningToRollup(
  prev: TaxRollup,
  amounts: { grossCents: number; entryFeeCents: number },
  thresholdCents: number,
): TaxRollup & { newlyRequired: boolean } {
  const grossWinningsCents = prev.grossWinningsCents + amounts.grossCents;
  const entryFeesCents = prev.entryFeesCents + amounts.entryFeeCents;
  const netProfitCents = grossWinningsCents - entryFeesCents;
  const winCount = prev.winCount + 1;
  const taxReportingRequired = grossWinningsCents >= thresholdCents;
  const newlyRequired = taxReportingRequired && !prev.taxReportingRequired;
  return {
    grossWinningsCents,
    entryFeesCents,
    netProfitCents,
    winCount,
    taxReportingRequired,
    newlyRequired,
  };
}

/**
 * Record a cash prize for tax purposes: write an IMMUTABLE winnings-ledger entry
 * and roll the user's calendar-year totals + 1099 flag forward — atomically and
 * idempotently. If the ledger entry already exists (re-settlement / retry) it is
 * a no-op: the ledger is never mutated and totals are never double-counted.
 */
export async function recordWinningForTax(
  db: Firestore,
  input: {
    uid: string;
    slateId: string;
    grossCents: number;
    entryFeeCents: number;
    /** Calendar year of the credit; defaults to the current UTC year. */
    year?: number;
  },
): Promise<void> {
  const year = input.year ?? new Date().getUTCFullYear();
  const ledgerRef = db
    .collection(COLLECTIONS.winningsLedger)
    .doc(`${input.slateId}_${input.uid}`);
  const yearRef = db
    .collection(COLLECTIONS.users)
    .doc(input.uid)
    .collection(COLLECTIONS.taxYears)
    .doc(String(year));

  await db.runTransaction(async (tx) => {
    const led = await tx.get(ledgerRef);
    if (led.exists) return; // IMMUTABLE + idempotent — already recorded.

    const prevSnap = await tx.get(yearRef);
    const prev = (prevSnap.data() as TaxRollup | undefined) ?? EMPTY_ROLLUP;
    const next = applyWinningToRollup(
      prev,
      { grossCents: input.grossCents, entryFeeCents: input.entryFeeCents },
      TAX_1099_THRESHOLD_CENTS,
    );

    tx.set(ledgerRef, {
      userId: input.uid,
      contestId: input.slateId,
      grossWinningsCents: input.grossCents,
      entryFeeCents: input.entryFeeCents,
      taxYear: year,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      yearRef,
      {
        year,
        grossWinningsCents: next.grossWinningsCents,
        entryFeesCents: next.entryFeesCents,
        netProfitCents: next.netProfitCents,
        winCount: next.winCount,
        taxReportingRequired: next.taxReportingRequired,
        ...(next.newlyRequired
          ? { taxReportingRequiredAt: FieldValue.serverTimestamp() }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}
