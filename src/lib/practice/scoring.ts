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
  /** Spot-race winnings multiplier (≥1). Landing a top spot boosts the winnings
   *  (SCORE only); applied to credited coins, never to the returned stake. */
  winningsMultiplier = 1,
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
  // The spot bonus scales actual winnings (not losses — 0 stays 0).
  if (winningsMultiplier !== 1 && creditedCoins > 0) {
    creditedCoins = Math.round(creditedCoins * winningsMultiplier);
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

/** Daily refill cooldown in ms (config-driven). */
export const PRACTICE_REFILL_COOLDOWN_MS =
  PRACTICE_CONFIG.coins.refillCooldownHours * 3_600_000;

/** Busted = can't afford the minimum stake (so they wait for the daily refill). */
export function isBusted(coins: number): boolean {
  return coins < PRACTICE_DEFAULT_STAKE;
}

/**
 * The pending refill time for a player: once busted, schedule the free refill
 * `refillCooldownHours` out (set once, sticky); when not busted, clear it.
 */
export function scheduledRefillAt(
  coins: number,
  currentRefillAt: number | null | undefined,
  nowMs: number,
): number | null {
  if (isBusted(coins)) return currentRefillAt ?? nowMs + PRACTICE_REFILL_COOLDOWN_MS;
  return null;
}

export interface RefillClaim {
  coins: number;
  refillAt: number | null;
  refilled: boolean;
}

/** Claim the free daily refill if busted AND the cooldown has elapsed. */
export function claimRefill(
  coins: number,
  refillAt: number | null | undefined,
  nowMs: number,
): RefillClaim {
  if (isBusted(coins) && refillAt && nowMs >= refillAt) {
    return { coins: PRACTICE_CONFIG.coins.refillTo, refillAt: null, refilled: true };
  }
  return { coins, refillAt: refillAt ?? null, refilled: false };
}
