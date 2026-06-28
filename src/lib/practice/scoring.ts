/**
 * PRACTICE MODE — scoring + coin (SCORE) math. PLAY-MONEY ONLY: coins produced
 * here are score for rank/leaderboard/bragging rights. They are never cashable,
 * transferable, or purchasable-with, and buy nothing of value.
 *
 * INSTANT SETTLEMENT: a contest's per-leg outcomes are pre-determined (rolled by
 * the engine, weighted by each leg's AI probability) and hidden at creation, then
 * revealed when a player submits — so scoring is instant, no waiting for a real
 * event. (Chosen over real past-event grading so practice is self-contained.)
 */

import { PRACTICE_CONFIG } from "./config";

export type Choice = "a" | "b";

/** Win-up-to coin multiplier by leg count (config-driven; index = legs). */
const PERFECT_MULT = PRACTICE_CONFIG.perfectMultiplier;

export interface PracticeResult {
  legs: number;
  correct: number;
  perfect: boolean;
  /** Coins (score) credited for the entry; can be 0. */
  creditedCoins: number;
  /** Net coin (score) change vs the stake. */
  net: number;
  /** Whether this entry counts as a "win" (finished in the money). */
  won: boolean;
  /** Per-leg correctness, in slate order. */
  hits: boolean[];
  /** Near-miss / celebration line for variable-reward feedback. */
  message: string;
}

/** A win = got at least ~60% of the legs right (rounded up). */
export function winThreshold(legs: number): number {
  return Math.max(1, Math.ceil(legs * 0.6));
}

/**
 * Score a player's picks against the contest's hidden outcomes and derive the
 * coin (score) result. Pays the full win-up-to on a perfect card, a pro-rated
 * share once past the win threshold, and nothing (lose the stake) below it.
 */
export function scorePractice(
  picks: Choice[],
  outcomes: Choice[],
  stake: number,
): PracticeResult {
  const legs = outcomes.length;
  const hits = outcomes.map((o, i) => picks[i] === o);
  const correct = hits.filter(Boolean).length;
  const perfect = correct === legs && legs > 0;
  const threshold = winThreshold(legs);
  const won = correct >= threshold;

  const gross = stake * (PERFECT_MULT[legs] ?? 0);
  let creditedCoins = 0;
  if (perfect) creditedCoins = gross;
  else if (won) {
    // Pro-rated between the threshold (small) and perfect (full).
    const frac = (correct - threshold + 1) / (legs - threshold + 1);
    creditedCoins = Math.round(gross * 0.5 * frac);
  }
  const net = creditedCoins - stake;

  let message: string;
  if (perfect) message = `Perfect card! ${legs}/${legs} 🔥`;
  else if (correct === legs - 1) message = `So close — ${correct} of ${legs}!`;
  else if (won) message = `In the money — ${correct} of ${legs}.`;
  else if (correct > 0) message = `${correct} of ${legs}. Run it back.`;
  else message = `Busted — 0 of ${legs}. Shake it off.`;

  return { legs, correct, perfect, creditedCoins, net, won, hits, message };
}

/** Practice coin economy constants (SCORE — not money). Sourced from config. */
export const PRACTICE_START_COINS = PRACTICE_CONFIG.coins.start;
/** Below this balance a player can refill (free) so the loop never hard-stops. */
export const PRACTICE_REFILL_THRESHOLD = PRACTICE_CONFIG.coins.refillThreshold;
export const PRACTICE_REFILL_TO = PRACTICE_CONFIG.coins.refillTo;
/** Default stake per practice entry. */
export const PRACTICE_DEFAULT_STAKE = PRACTICE_CONFIG.coins.defaultStake;

/** A streak strong enough to earn the (rare) funnel-to-paid nudge. */
export const STREAK_NUDGE_AT = PRACTICE_CONFIG.nudge.streakAt;

/** Rolling window (recent entries) used to estimate a player's win rate. */
export const PRACTICE_RECENT_WINDOW = PRACTICE_CONFIG.recentWindow;
