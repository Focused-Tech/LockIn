/**
 * LockIn business rules — the single source of truth for all money math.
 *
 * INVARIANTS:
 *  - All money is stored and computed in CENTS (integers). Never floats for money.
 *  - "Rake" is an internal term ONLY. Never surface it in UI — users see
 *    "entry fee" and "prize pool".
 *  - Percentages here are fractions (0.15 === 15%).
 */

// ── Entry tiers ─────────────────────────────────────────────
/** Supported paid entry tiers, in whole dollars. */
export const ENTRY_TIERS = [5, 10, 25] as const;
export type EntryTier = (typeof ENTRY_TIERS)[number];

// ── Rake ────────────────────────────────────────────────────
// RETIRED (Jul 28): the discrete tier table (RAKE_TIERS) and the $250K MEGA_RAKE override are gone —
// rake is now the ONE pool-size curve in contest/poolRake.ts (bands in architectSet.SUB_10K_RAKE_BANDS).
// MEGA_RAKE is retired, not repurposed; it is not canon.

// ── Payout cap ──────────────────────────────────────────────
/** Max any single winner receives = this × their total entry cost. Overflow → LockIn. */
export const PAYOUT_CAP_MULTIPLIER = 1000;

// ── Card Rush ───────────────────────────────────────────────
/** Allowed prize multipliers for a Card Rush (boosted) contest. LockIn funds the boost. */
export const CARD_RUSH_MULTIPLIERS = [2, 3] as const;
export type CardRushMultiplier = (typeof CARD_RUSH_MULTIPLIERS)[number];

// ── Revenue splits (platform / creator) ─────────────────────
export const HOSTING_FEE_SPLIT = { platform: 0.6, creator: 0.4 } as const;
export const PACKAGE_SPLIT = { platform: 0.6, creator: 0.4 } as const;

/** Minimum cash price for a pick package (cents). $0.99. */
export const PACKAGE_MIN_PRICE_CENTS = 99;
/** Maximum cash price for a pick package (cents). $500. */
export const PACKAGE_MAX_PRICE_CENTS = 500_00;

// ── Cross-slate parlays ─────────────────────────────────────
/** Display multiplier by pick count (potential payout multiple). Stored on the doc. */
export const CROSS_PARLAY_MULTIPLIERS: Record<number, number> = {
  2: 3,
  3: 6,
  4: 11,
  5: 20,
  6: 40,
  7: 50,
  8: 75,
  9: 100,
  10: 150,
};
export const CROSS_PARLAY_MIN_PICKS = 2;
export const CROSS_PARLAY_MAX_PICKS = 10;
/** A parlay must span at least this many distinct slates. */
export const CROSS_PARLAY_MIN_SLATES = 2;

// ── Payout eligibility & curve ──────────────────────────────
/** Below this many paid participants, the slate auto-converts to free (entries refunded). */
export const MIN_PARTICIPANTS_FOR_PAYOUT = 20;

/** Fraction of participants (rounded) that receive a payout. */
export const TOP_PERCENT_PAID = 0.25;

/**
 * Share of the (post-rake) prize pool paid to each finishing rank.
 * Range keys cover inclusive rank bands; the listed share is paid to EACH
 * position within the band. Use {@link payoutShareForRank} to resolve a rank.
 */
export const PAYOUT_CURVE = {
  1: 0.12,
  2: 0.07,
  3: 0.045,
  4: 0.03,
  5: 0.025,
  "6-10": 0.02,
  "11-25": 0.01,
  "26-50": 0.005,
  "51-100": 0.0025,
  "101-175": 0.0015,
  "176-250": 0.0012,
} as const;

/** Ordered band definitions derived from {@link PAYOUT_CURVE}. */
export const PAYOUT_BANDS: ReadonlyArray<{ min: number; max: number; share: number }> = [
  { min: 1, max: 1, share: 0.12 },
  { min: 2, max: 2, share: 0.07 },
  { min: 3, max: 3, share: 0.045 },
  { min: 4, max: 4, share: 0.03 },
  { min: 5, max: 5, share: 0.025 },
  { min: 6, max: 10, share: 0.02 },
  { min: 11, max: 25, share: 0.01 },
  { min: 26, max: 50, share: 0.005 },
  { min: 51, max: 100, share: 0.0025 },
  { min: 101, max: 175, share: 0.0015 },
  { min: 176, max: 250, share: 0.0012 },
];

// ── Coins ───────────────────────────────────────────────────
/** Coins granted at signup. */
export const SIGNUP_BONUS_COINS = 500;

/** Coins charged to enter the free (coin) tier of a contest. */
export const FREE_ENTRY_COIN_COST = 100;

// ── Pro subscription ────────────────────────────────────────
/** User Pro subscription price (cents/month). $9.99. */
export const PRO_PRICE_CENTS = 999;

// ── Referrals ───────────────────────────────────────────────
/** Coins paid to the referrer when someone signs up with their code. */
export const REFERRAL_SIGNUP_COINS = 250;
/** Bonus coins granted to a new user who signed up via a referral. */
export const REFERRED_WELCOME_COINS = 250;
/**
 * Cash bonus (cents) paid to the referrer once a referred user becomes a paid
 * user (first successful deposit). $1.00.
 */
export const REFERRAL_PAID_BONUS_CENTS = 1_00;
/**
 * Recurring commission (cents) paid to the referrer each month a referred user
 * pays for Pro — 20% of the $9.99 plan. $2.00.
 */
export const REFERRAL_PRO_COMMISSION_CENTS = 2_00;

/** Coin balance → dollar value of the paid-entry token it redeems for. */
export const COIN_REDEMPTION: Record<number, number> = {
  5000: 5,
  10000: 10,
  20000: 25,
};

/** Coin-redeemed entry tokens expire after this many days; no cash value. */
export const COIN_TOKEN_EXPIRY_DAYS = 30;

// ── Stripe fees ─────────────────────────────────────────────
/** Processing fees are 100% passed to the customer at deposit time. LockIn pays $0. */
export const STRIPE_FEES_PASSED_TO_CUSTOMER = true;

/** Card processing: 2.9% + $0.30. Used to compute the customer-visible fee. */
export const STRIPE_CARD_FEE = { percent: 0.029, fixedCents: 30 } as const;

// ── Deposits ────────────────────────────────────────────────
/** Minimum single deposit (cents). $5. */
export const DEPOSIT_MIN_CENTS = 5_00;
/** Maximum single deposit (cents). $500. */
export const DEPOSIT_MAX_CENTS = 500_00;
/** Quick-amount presets (cents): $10, $25, $50, $100. */
export const DEPOSIT_PRESETS_CENTS = [10_00, 25_00, 50_00, 100_00] as const;
/** Supported deposit rails. ACH (bank transfer) is fee-free. */
export type PaymentMethodKind = "card" | "ach";

// ── Responsible play ────────────────────────────────────────
/**
 * Deposit limit defaults — these are also the regulatory MAXIMUMS. Users may
 * only adjust their limits DOWN (tighter), never above these caps.
 */
export const DEPOSIT_LIMITS = {
  dailyCents: 500_00,
  weeklyCents: 2000_00,
  monthlyCents: 5000_00,
} as const;

/** Self-exclusion period options. `ms: null` = permanent. */
export const SELF_EXCLUSION_PERIODS = [
  { key: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "permanent", label: "Permanent", ms: null },
] as const;

export type SelfExclusionKey = (typeof SELF_EXCLUSION_PERIODS)[number]["key"];

/** Sentinel "until" for a permanent self-exclusion (~year 3000). */
export const PERMANENT_EXCLUSION_MS = 32_503_680_000_000;

/** National Problem Gambling hotline. */
export const NCPG_HOTLINE = "1-800-522-4700";

// ── Geo-fencing ─────────────────────────────────────────────
/** Paid contests are blocked in these states. Free play is unrestricted. */
export const EXCLUDED_STATES = ["WA", "AZ", "IA", "LA", "MT", "SC"] as const;
export type ExcludedState = (typeof EXCLUDED_STATES)[number];

// ── Contest scoring ─────────────────────────────────────────
export const SCORING = {
  /** Points per correct pick. */
  pointsPerCorrect: 10,
  /** Multiplier applied for each consecutive correct pick. */
  consecutiveMultiplier: 1.2,
  /** Bonus multiplier for a perfect card (all picks correct). */
  perfectCardBonus: 2,
} as const;

// ── Settlement ──────────────────────────────────────────────
/** AI outcome verifier auto-settles at/above this confidence. */
export const AUTO_SETTLE_CONFIDENCE = 0.99;
/** Minimum independent sources required to verify an outcome. */
export const MIN_VERIFICATION_SOURCES = 3;

// ── Compliance ──────────────────────────────────────────────
/** Minimum age to participate. */
export const MIN_AGE = 18;
/** Minimum withdrawal amount (cents). $10. */
export const MIN_WITHDRAWAL_CENTS = 10_00;
/** Annual winnings (cents) at/above which a 1099-MISC is reported. $600. */
export const TAX_REPORTING_THRESHOLD_CENTS = 600_00;
