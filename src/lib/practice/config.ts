/**
 * PRACTICE MODE — TUNABLE CONFIG (single source of truth).
 *
 * Every threshold, band, and frequency lives here so they can be retuned against
 * real player data WITHOUT a code change. PLAY-MONEY ONLY: practice coins are
 * SCORE — never cashable, transferable, purchasable-with, or redeemable; they
 * buy nothing and share no value with real-money slates.
 */

export type PracticeTierKey = "rookie" | "sharp" | "pro" | "elite" | "legend";

export const PRACTICE_CONFIG = {
  /** EARNED rank tiers by LIFETIME practice coins (status, not purchase). The
   *  `max` of each tier is derived as the next tier's `min` − 1 (Legend = ∞). */
  tiers: [
    { key: "rookie", label: "Rookie", min: 0, blurb: "Learning the board" },
    { key: "sharp", label: "Sharp", min: 1_000, blurb: "Reading the lines" },
    { key: "pro", label: "Pro", min: 5_000, blurb: "Finding the edges" },
    { key: "elite", label: "Elite", min: 25_000, blurb: "Beating the traps" },
    { key: "legend", label: "Legend", min: 100_000, blurb: "Top of the board" },
  ] as { key: PracticeTierKey; label: string; min: number; blurb: string }[],

  /** Per-tier base difficulty + the [min,max] leg band the dynamic tune may use. */
  difficulty: {
    rookie: { legs: 3, bounds: [3, 3], lineStyle: "easy lines with clear-favorite props (one side ~70%+)" },
    sharp: { legs: 4, bounds: [3, 4], lineStyle: "tighter lines, modest favorites (~58–68%)" },
    pro: { legs: 5, bounds: [5, 5], lineStyle: "coin-flip props and subtle edges (~50–58%)" },
    elite: { legs: 6, bounds: [5, 6], lineStyle: "sharp lines with at least one correlated-trap pair" },
    legend: { legs: 7, bounds: [7, 7], lineStyle: "brutal lines, maximal leg independence, no easy outs" },
  } as Record<PracticeTierKey, { legs: number; bounds: [number, number]; lineStyle: string }>,

  /** DYNAMIC difficulty: keep each player inside this win-rate band (flow channel).
   *  Above `high` → nudge harder; below `low` → nudge easier. */
  winRateBand: { low: 0.4, high: 0.55 },
  /** Rolling window (recent entries) used to estimate a player's win rate. */
  recentWindow: 10,

  /** Sharp Score percentile shown passively per tier ("top X% of predictors"). */
  sharpPercentile: { rookie: 60, sharp: 30, pro: 12, elite: 4, legend: 1 } as Record<
    PracticeTierKey,
    number
  >,

  /** Funnel-to-paid nudge — earned + rare, never naggy. */
  nudge: {
    /** Eligible at this tier index or higher (0=Rookie … 2=Pro). */
    minTierIndex: 2,
    /** …OR on a win streak of at least this length. */
    streakAt: 4,
    /** Show at most this many times per session (client-enforced). */
    perSessionCap: 1,
  },

  /** Coin (SCORE) economy — play-money only. Coins are NEVER purchasable with
   *  real money. The refill is a DAILY free top-up (wait, not instant). */
  coins: {
    start: 500,
    /** At/under this balance the player is "busted" and waits for the daily refill. */
    refillThreshold: 0,
    /** Free daily top-up amount. */
    refillTo: 500,
    /** Hours to wait after busting before the free refill is available. */
    refillCooldownHours: 24,
    defaultStake: 50,
  },

  /** Win-up-to multiplier by leg count (index = legs). Variable-reward curve. */
  perfectMultiplier: [0, 2, 4, 8, 16, 28, 48, 80],
} as const;
