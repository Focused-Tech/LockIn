/**
 * THE POOL-SIZE RAKE CURVE — the ONE economy (architect ruling, Jul 28).
 *
 * There is one economy: creators build slates, players enter them, and the SAME curve that defines
 * the creator's pot is what settles the players. The legacy tier table (RAKE_TIERS/MEGA_RAKE in
 * constants.ts, read by computeRake) is stale from before this model existed and is no longer called.
 *
 * CANONICAL CURVE (ledger — verified against the builder preview at $1K/$5K/$10K/$100K/$250K/$1M/$10M):
 *   15/20/30% bands under $10K · 40% at $10K · +6.75% per 10× above · hard cap 65% · Championship 78%.
 *
 * ONE function for BOTH the builder preview and settlement, so they can never diverge again. The base
 * bands (15/20/30) live in architectSet (SUB_10K_RAKE_BANDS); the legacy tier table + computeRake
 * (contest/rake.ts) are retired.
 */
import { SUB_10K_RAKE_BANDS } from "./architectSet";

/** The rake RATE for a gross pool (cents). `championship` raises the hard cap from 65% to 78%.
 *  Under $10K uses the ruled base bands; at/above $10K it's 40% + 6.75% per 10×, capped. */
export function poolSizeRate(grossPoolCents: number, championship = false): number {
  const sub10k = SUB_10K_RAKE_BANDS.find((b) => grossPoolCents < b.belowCents);
  if (sub10k) return sub10k.rate;
  const pool = grossPoolCents / 100; // dollars
  const cap = championship ? 0.78 : 0.65;
  return Math.min(cap, 0.4 + 0.0675 * Math.log10(pool / 10000));
}

export interface PoolRakeResult {
  rateApplied: number;
  rakeCents: number;
  prizePoolCents: number;
}

/** Rake a gross pool (cents): rake = floor(gross × rate); prize pool = gross − rake. */
export function poolSizeRake(grossPoolCents: number, championship = false): PoolRakeResult {
  const rateApplied = poolSizeRate(grossPoolCents, championship);
  const rakeCents = Math.floor(grossPoolCents * rateApplied);
  return { rateApplied, rakeCents, prizePoolCents: grossPoolCents - rakeCents };
}
