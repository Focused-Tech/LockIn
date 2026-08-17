/**
 * DELETION BLOCKERS — the conditions under which an account cannot be deleted yet, and the exact
 * words the player is told.
 *
 * The bar is deliberately narrow. Apple 5.1.1(v) and Google both require in-app deletion to actually
 * work, so a blocker is only legitimate where deleting would destroy a record of money we owe, money
 * in flight, or a contest other people are still playing. "We'd rather keep you" is not a blocker.
 * Everything here resolves on its own — a contest settles, a payout lands — or by the player taking
 * one named action, and the message says which.
 *
 * Pure: no Firestore, no I/O. The caller gathers the counts; this decides. That keeps the rule
 * itself directly testable against known-bad inputs.
 */
import { formatCents } from "@/lib/utils";

export type BlockerCode =
  | "CASH_BALANCE"
  | "PENDING_WITHDRAWAL"
  | "PENDING_DEPOSIT"
  | "OPEN_ENTRIES"
  | "OPEN_HOSTED_CONTESTS";

export interface Blocker {
  code: BlockerCode;
  /** Player-facing. Says what is in the way and what clears it. No jargon. */
  message: string;
  /** True when the player has to do something; false when it clears by itself. */
  needsPlayerAction: boolean;
}

export interface BlockerInput {
  cashBalanceCents: number;
  pendingWithdrawals: number;
  pendingDeposits: number;
  /** Entries sitting in contests that have not settled or been cancelled. */
  openEntries: number;
  /** Contests this user hosts that have not settled or been cancelled. */
  openHostedContests: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Evaluate every blocker at once. Returns them all rather than the first, so the player sees the
 * whole list in one pass instead of clearing one and discovering another.
 */
export function evaluateBlockers(input: BlockerInput): Blocker[] {
  const blockers: Blocker[] = [];

  if (input.cashBalanceCents > 0) {
    blockers.push({
      code: "CASH_BALANCE",
      message: `You still have ${formatCents(
        input.cashBalanceCents,
      )} in your wallet. Withdraw it first — we can't delete the record of money we owe you.`,
      needsPlayerAction: true,
    });
  }

  if (input.pendingWithdrawals > 0) {
    blockers.push({
      code: "PENDING_WITHDRAWAL",
      message: `${plural(
        input.pendingWithdrawals,
        "withdrawal is",
        "withdrawals are",
      )} still on the way to your bank. Once the money lands you can delete.`,
      needsPlayerAction: false,
    });
  }

  if (input.pendingDeposits > 0) {
    blockers.push({
      code: "PENDING_DEPOSIT",
      message: `${plural(
        input.pendingDeposits,
        "payment is",
        "payments are",
      )} still clearing. Once it finishes you can delete.`,
      needsPlayerAction: false,
    });
  }

  if (input.openEntries > 0) {
    blockers.push({
      code: "OPEN_ENTRIES",
      message: `You're in ${plural(
        input.openEntries,
        "contest",
        "contests",
      )} that hasn't finished. They play out first — you can delete once they're scored.`,
      needsPlayerAction: false,
    });
  }

  if (input.openHostedContests > 0) {
    blockers.push({
      code: "OPEN_HOSTED_CONTESTS",
      message: `You're hosting ${plural(
        input.openHostedContests,
        "contest",
        "contests",
      )} that hasn't finished. Players are still in it, so it has to finish before your account can go.`,
      needsPlayerAction: false,
    });
  }

  return blockers;
}

/** Convenience: nothing in the way. */
export function canDelete(input: BlockerInput): boolean {
  return evaluateBlockers(input).length === 0;
}
