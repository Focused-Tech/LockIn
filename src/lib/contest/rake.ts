import {
  MEGA_RAKE,
  MEGA_RAKE_THRESHOLD_CENTS,
  RAKE_TIERS,
  type EntryTier,
} from "@/lib/constants";
import type { Cents, RakeResult } from "@/lib/types";

/**
 * Resolve the rake and resulting prize pool for a slate.
 *
 * The mega rake (35%) applies whenever the GROSS pool exceeds $250K, overriding
 * the per-tier rate. All amounts are cents; the rake is floored so the prize
 * pool never under-distributes.
 *
 * @param tier         Entry tier in whole dollars (5 | 10 | 25).
 * @param grossPoolCents Total entry fees collected, in cents.
 */
export function computeRake(tier: EntryTier, grossPoolCents: Cents): RakeResult {
  const rateApplied =
    grossPoolCents > MEGA_RAKE_THRESHOLD_CENTS ? MEGA_RAKE : RAKE_TIERS[tier];

  const rakeCents = Math.floor(grossPoolCents * rateApplied);
  const prizePoolCents = grossPoolCents - rakeCents;

  return { tier, rateApplied, rakeCents, prizePoolCents };
}
