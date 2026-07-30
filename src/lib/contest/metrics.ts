import type { EntryTier } from "@/lib/constants";
import type { Cents } from "@/lib/types";
import { poolSizeRake } from "./poolRake";
import { computeRankPayout } from "./payout";

export interface SlateMetrics {
  /** Total entry fees collected (pre-rake). */
  grossPoolCents: Cents;
  /** Prize pool after rake — what gets distributed. */
  prizePoolCents: Cents;
  /** Current 1st-place payout (cap applied). */
  firstPlaceCents: Cents;
  /** 1st-place payout as a multiple of one entry cost. */
  firstPlaceMultiple: number;
  /** One entry's total cost (entry fee + hosting fee). */
  entryCostCents: Cents;
}

/**
 * Live feed economics for a slate at a given entry tier.
 *
 * The prize pool is funded by entry fees (hosting fees are separate creator
 * revenue), so gross pool = entryFee × entryCount. Rake and the 1st-place curve
 * + 1,000× cap come from the contest engine. A `rushMultiplier` > 1 (Card Rush)
 * boosts the post-rake prize pool — LockIn funds the extra. Pure function — safe
 * on the client so realtime updates recompute as the entry count changes.
 */
export function computeSlateMetrics(
  tier: EntryTier,
  hostingFeeCents: Cents,
  entryCount: number,
  rushMultiplier = 1,
): SlateMetrics {
  const entryFeeCents = tier * 100;
  const grossPoolCents = entryFeeCents * Math.max(0, entryCount);
  const entryCostCents = entryFeeCents + hostingFeeCents;

  const base = poolSizeRake(grossPoolCents); // §one-economy: pool-size curve, not the tier table
  const prizePoolCents = Math.round(
    base.prizePoolCents * Math.max(1, rushMultiplier),
  );
  const { payoutCents: firstPlaceCents } = computeRankPayout(
    1,
    prizePoolCents,
    entryCostCents,
  );

  const firstPlaceMultiple =
    entryCostCents > 0 ? firstPlaceCents / entryCostCents : 0;

  return {
    grossPoolCents,
    prizePoolCents,
    firstPlaceCents,
    firstPlaceMultiple,
    entryCostCents,
  };
}
