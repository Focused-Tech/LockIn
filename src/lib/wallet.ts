/** Serializable wallet DTOs (no Firestore Timestamps) for client components. */

export type TransactionKind = "deposit" | "withdrawal" | "entry" | "winnings";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  description: string;
  /** Signed cents: positive = credit to the user, negative = debit. */
  amountCents: number;
  status: string;
  timestampMs: number;
}
