import {
  PAYOUT_BANDS,
  PAYOUT_CAP_MULTIPLIER,
  TOP_PERCENT_PAID,
} from "@/lib/constants";
import type { Cents, RankPayout } from "@/lib/types";

/**
 * Share of the prize pool paid to a given finishing rank, per the payout curve.
 * Returns 0 for ranks outside the published bands (rank > 250 or < 1).
 */
export function payoutShareForRank(rank: number): number {
  if (rank < 1) return 0;
  for (const band of PAYOUT_BANDS) {
    if (rank >= band.min && rank <= band.max) return band.share;
  }
  return 0;
}

/** Number of participants that receive a payout (top 25%, rounded). */
export function paidPositions(participantCount: number): number {
  return Math.round(participantCount * TOP_PERCENT_PAID);
}

/**
 * Compute the payout for a single rank, applying the 1,000x entry-cost cap.
 * Overflow above the cap becomes LockIn revenue.
 *
 * @param rank             Finishing position (1-based).
 * @param prizePoolCents   Post-rake prize pool, in cents.
 * @param entryCostCents   The winner's TOTAL entry cost (entry + hosting), in cents.
 */
export function computeRankPayout(
  rank: number,
  prizePoolCents: Cents,
  entryCostCents: Cents,
): RankPayout {
  const shareApplied = payoutShareForRank(rank);
  const grossCents = Math.floor(prizePoolCents * shareApplied);

  const capCents = entryCostCents * PAYOUT_CAP_MULTIPLIER;
  const payoutCents = Math.min(grossCents, capCents);
  const overflowCents = grossCents - payoutCents;

  return { rank, shareApplied, grossCents, payoutCents, overflowCents };
}
