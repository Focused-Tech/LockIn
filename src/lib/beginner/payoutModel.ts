/**
 * BEGINNER JOURNEY — ISOLATED TUNABLE PAYOUT MODEL
 * ================================================
 * Every payout / rank / "win up to" / shadow-cash number shown anywhere in the
 * beginner journey derives from THIS module. No component computes payout math
 * inline — they all call the helpers here. To re-tune the journey's economics,
 * change the constants in this one block.
 *
 * ⚠️ PLACEHOLDERS, NOT REAL SCORING. These values reproduce the design-spec demo
 * math (design/lockin-beginner-journey.html). They are NOT the real contest
 * scoring/settlement rules — that engine is out of scope and not built. The
 * "result" screen is an illustrative projection driven by a user-controlled
 * "how many landed" stepper, exactly as in the spec. Do not represent any number
 * produced here as a settled, real-money outcome.
 */

// ── TUNABLE CONSTANTS (placeholders — pending real scoring rules) ────────────
export const PAYOUT_MODEL = {
  /** Win-up-to gross multiplier on stake, indexed by number of legs (0..4). */
  MULT: [0, 2.4, 5.8, 12, 24] as const,
  /** Projected finishing percentile if ALL legs land, by leg count (lower=better). */
  PROJ_ALL: [0, 40, 22, 9, 3] as const,
  /** Each missed leg pushes the projected percentile this much worse. */
  MISS_PENALTY: 18,
  /** Top N% of the field gets paid. */
  PAID_LINE: 30,
  /** The live cash tier the journey shadows results against ($5). */
  CASH_ENTRY: 5,
  /** If paid but not perfect, fraction of "win up to" credited. */
  PARTIAL_PAID_FRAC: 0.5,
} as const;

/** Max legs allowed in a beginner combo (base pick + up to 3 more). */
export const MAX_LEGS = 4;

/** Stake options (coins) offered on the single-pick screen. */
export const STAKE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_STAKE = 50;

/** Gross "win up to" (coins) for a combo of `legs` at `stake` coins. */
export function winUpTo(stake: number, legs: number): number {
  const m = PAYOUT_MODEL.MULT[legs] ?? 0;
  return Math.round(stake * m);
}

/** Projected percentile if all `legs` land (lower = better rank). */
export function projectedPercentile(legs: number): number {
  return PAYOUT_MODEL.PROJ_ALL[legs] ?? 99;
}

/** Whether a given percentile clears the paid line (top {@link PAYOUT_MODEL.PAID_LINE}%). */
export function isPaidPercentile(pct: number): boolean {
  return pct <= PAYOUT_MODEL.PAID_LINE;
}

export interface BeginnerResult {
  /** Total legs in the entry. */
  legs: number;
  /** How many legs landed. */
  landed: number;
  /** Projected finishing percentile given misses. */
  pct: number;
  /** Whether the entry finished in the paid band. */
  paid: boolean;
  /** Coins credited (0 if unpaid; full win-up-to if perfect; partial otherwise). */
  creditedCoins: number;
  /** Net coin change (credited − stake). */
  coinNet: number;
  /** Net cash change vs. a $CASH_ENTRY entry (two-way: can be negative). */
  cashNet: number;
}

/**
 * Derive the full result for `landed` of `legs` correct at a given coin `stake`.
 * Mirrors the spec's `resultFor`: misses worsen the percentile; paid entries
 * credit the full win-up-to when perfect, else a partial fraction; the shadow
 * cash line is two-way (what a $CASH_ENTRY cash entry would have won OR lost).
 */
export function resultFor(
  stake: number,
  legs: number,
  landed: number,
): BeginnerResult {
  const safeLanded = Math.max(0, Math.min(landed, legs));
  const missed = legs - safeLanded;
  const pct = Math.min(99, projectedPercentile(legs) + missed * PAYOUT_MODEL.MISS_PENALTY);
  const paid = isPaidPercentile(pct);
  const gross = winUpTo(stake, legs);
  const creditedCoins = !paid
    ? 0
    : missed === 0
      ? gross
      : Math.round(gross * PAYOUT_MODEL.PARTIAL_PAID_FRAC);
  const coinNet = creditedCoins - stake;

  const cashEntry = PAYOUT_MODEL.CASH_ENTRY;
  const cashCredited = stake > 0 ? (creditedCoins / stake) * cashEntry : 0;
  const cashNet = paid ? cashCredited - cashEntry : -cashEntry;

  return { legs, landed: safeLanded, pct, paid, creditedCoins, coinNet, cashNet };
}
