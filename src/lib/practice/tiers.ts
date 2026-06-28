/**
 * PRACTICE MODE — rank tiers + difficulty curve. All tunable values come from
 * {@link PRACTICE_CONFIG} so they can be retuned without code changes.
 *
 * FIREWALL: practice coins are SCORE — never cashable/transferable/purchasable-
 * with/redeemable, and buy nothing. Tiers are EARNED titles (status), not bought.
 */
import { PRACTICE_CONFIG, type PracticeTierKey } from "./config";

export type { PracticeTierKey };

export interface PracticeTier {
  key: PracticeTierKey;
  label: string;
  min: number;
  max: number; // inclusive (Infinity for the top tier)
  blurb: string;
}

/** Tiers derived from config — each tier's max is the next tier's min − 1. */
export const PRACTICE_TIERS: PracticeTier[] = PRACTICE_CONFIG.tiers.map(
  (t, i, arr) => ({
    ...t,
    max: i + 1 < arr.length ? arr[i + 1]!.min - 1 : Infinity,
  }),
);

export interface RankInfo {
  tier: PracticeTier;
  index: number;
  next: PracticeTier | null;
  toNext: number;
  progress: number; // 0–1 through the current tier
}

/** Resolve a lifetime-coins total to its earned rank tier + progress. */
export function rankForCoins(lifetimeCoins: number): RankInfo {
  const coins = Math.max(0, Math.floor(lifetimeCoins));
  let index = 0;
  for (let i = PRACTICE_TIERS.length - 1; i >= 0; i--) {
    if (coins >= PRACTICE_TIERS[i]!.min) {
      index = i;
      break;
    }
  }
  const tier = PRACTICE_TIERS[index]!;
  const next = PRACTICE_TIERS[index + 1] ?? null;
  const toNext = next ? next.min - coins : 0;
  const span = (next ? next.min : tier.min + 1) - tier.min;
  const progress = next ? Math.min(1, (coins - tier.min) / span) : 1;
  return { tier, index, next, toNext, progress };
}

export interface Difficulty {
  legs: number;
  lineStyle: string;
  label: string;
}

/**
 * Difficulty for a tier, DYNAMICALLY tuned to keep play "just barely beatable"
 * (the flow channel). Targets the configured win-rate band: nudge leg count up
 * when winning a lot, down when busting, clamped to the tier's leg bounds.
 * `recentWinRate` is 0–1 over a recent window (undefined → base difficulty).
 */
export function difficultyForTier(
  tierKey: PracticeTierKey,
  recentWinRate?: number,
): Difficulty {
  const d = PRACTICE_CONFIG.difficulty[tierKey];
  const label = PRACTICE_TIERS.find((t) => t.key === tierKey)?.label ?? tierKey;
  let legs = d.legs;
  if (recentWinRate !== undefined) {
    const [lo, hi] = d.bounds;
    if (recentWinRate > PRACTICE_CONFIG.winRateBand.high)
      legs = Math.min(hi, legs + 1);
    else if (recentWinRate < PRACTICE_CONFIG.winRateBand.low)
      legs = Math.max(lo, legs - 1);
  }
  return { legs, lineStyle: d.lineStyle, label };
}
