/**
 * ARCHITECT-SET PLACEHOLDERS — ONE FILE (slice 6.4).
 *
 * Every number the architect must supply lives here, each carrying an `ARCHITECT-SET: awaiting
 * value` marker. NEVER inline a guessed number at a call site — import from here. When the architect
 * fills these, it happens in one pass.
 *
 * NOTE ON RAKE: rake itself is READ-ONLY and lives in contest/rake.ts + constants.ts (tier-based
 * with a $250K mega override). The `SUB_10K_RAKE_BANDS` below are ONLY for the pool-size rake model
 * described in the mockup; they are NOT wired into the live rake and change nothing until the
 * architect adopts that model. Flagged in the close-out.
 */

export const ARCHITECT_SET = "awaiting value" as const;

/* ── Creator cut (slice 6.2) ─────────────────────────────────────────────────── */
/** Cut slides 50% (small pools) → 20% (large), capped $500,000/slate. Anchors are known; the
 *  SLIDE POINTS between them are architect-set — the mockup interpolates on log10, placeholder only. */
export const CREATOR_CUT_ANCHOR_HIGH = 0.5; // small pool
export const CREATOR_CUT_ANCHOR_LOW = 0.2; // large pool
export const CREATOR_CUT_CAP_CENTS = 500_000_00; // $500,000/slate — known
// ARCHITECT-SET: awaiting value — the pool sizes at which the cut passes through intermediate points.
export const CREATOR_CUT_SLIDE_POINTS: { poolCents: number; cut: number }[] = [];

/* ── Division follower midpoints (slice 6.3 / 5.4) ───────────────────────────── */
// ARCHITECT-SET: awaiting value — placeholder midpoints; flagged in the UI.
export const DIVISION_FOLLOWERS = {
  hawk: 50_000,
  wolf: 300_000,
  shark: 750_000,
  boss: 2_000_000,
} as const;
export type Division = keyof typeof DIVISION_FOLLOWERS;

/* ── Projection conversion band (slice 6.3) — the architect's numbers, NOT DFS rates ── */
/** Conversion FLOOR is 1 in 10 followers; top band 1 in 4. No taper by division size. */
export const CONV_LO = 0.1;
export const CONV_HI = 0.25;

/* ── Host fee → division (slice 5.2) ─────────────────────────────────────────── */
// ARCHITECT-SET: awaiting value — which host-fee tier each division is allowed/defaulted to.
export const HOST_FEE_BY_DIVISION: Partial<Record<Division, number>> = {
  // hawk: 1, wolf: 2, shark: 2, boss: 3   ← mockup placeholder, awaiting architect confirmation
};
/** The host-fee tiers a creator may pick ($ on top of the entry stake). */
export const HOST_FEE_TIERS = [1, 2, 3] as const;

/* ── Entry stakes (slice 5.2) ────────────────────────────────────────────────── */
export const BASE_STAKES = [5, 10, 15] as const;
export const BIG_POT_STAKES = [25, 50] as const;
// ARCHITECT-SET: awaiting value — do $25/$50 unlock by POT SIZE or by DIVISION? (and the threshold)
export const BIG_STAKE_UNLOCK: { mode: "pot_size" | "division" | null; threshold: number | null } = {
  mode: null,
  threshold: null,
};

/* ── Sub-$10K rake bands — RULED (Jul 28): the base bands under the pool-size rake curve ── */
// The pool-size rake model is the ONE economy (poolRake.ts). These are the ruled base bands under
// $10K (15/20/30); at/above $10K the curve is 40% + 6.75% per 10×, hard cap 65% (championship 78%).
// Ordered ascending — the rate for a pool is the FIRST band whose `belowCents` exceeds the pool.
export const SUB_10K_RAKE_BANDS: { belowCents: number; rate: number }[] = [
  { belowCents: 1_000_00, rate: 0.15 },
  { belowCents: 5_000_00, rate: 0.2 },
  { belowCents: 10_000_00, rate: 0.3 },
];

/* ── SURFACE GATE — which categories are CASH SPORTS (Part A) ─────────────────── */
/**
 * The mobile binary serves coins everywhere and CASH only on SPORTS. Cash entertainment is a web
 * surface concern and is omitted from the mobile payload entirely.
 *
 * This is an ALLOWLIST on purpose. A category not named here is treated as non-sports, so a category
 * added later fails CLOSED (its cash slates stop serving on mobile) rather than leaking onto the
 * binary because nobody remembered to classify it.
 *
 * Names must match `CATEGORIES` in src/lib/categories.ts exactly. Matching is case-insensitive.
 */
export const CASH_SPORTS_CATEGORIES: readonly string[] = [
  "NASCAR",
  "UFC",
  "Boxing",
  "Tennis",
  "Golf",
  "Soccer",
  "NFL",
  "NBA",
  "MLB",
  "NHL",
];
// ARCHITECT-SET: awaiting value — "Esports" is deliberately NOT in the list above. It is competitive
// gaming, not a traditional sport, and the ruling said "cash SPORTS stays". Failing closed until the
// architect rules. Adding the string to the list is the whole change if the answer is yes.

/* ── Sport key (used by the stats provider + creator games) ──────────────────── */
// The composite scoring WEIGHTS that used to live here were Claude's invention, not the architect's,
// and have been removed. Cross-game settlement compares players on the `composite` already carried by
// resolveArchetype (contest/archetypes.ts) — no weighting formula, no placeholder to fill.
export type ScoringSport = "basketball" | "football" | "baseball" | "hockey" | "soccer";

/* ── KEYHOLDER PORTAL (referral-tracking rails — slice: Keyholder) ─────────────── */
// Every rate/cap/threshold in the keyholder system lives here. NULL / [] means "unset placeholder":
// the portal shows event tallies and "—" for every dollar figure until the architect fills these.
// NEVER inline a number at a call site — import from here.

// ARCHITECT-SET: awaiting value — participation% → keyholder rate. Sorted-desc lookup; [] = unarmed.
export const KEYHOLDER_TRIGGER_BANDS: { minParticipationPct: number; rate: number }[] = [];
// ARCHITECT-SET: awaiting value — annual payout cap per keyholder (cents).
export const KEYHOLDER_ANNUAL_CAP_CENTS: number | null = null;
// ARCHITECT-SET: awaiting value — keymaster override rate on their downline keyholders' earnings.
export const KEYMASTER_OVERRIDE_RATE: number | null = null;
// ARCHITECT-SET: awaiting value — annual payout cap per keymaster (cents).
export const KEYMASTER_ANNUAL_CAP_CENTS: number | null = null;
// ARCHITECT-SET: awaiting value — settled-entry $ a referred player must reach to qualify (cents).
export const PLAYER_QUALIFY_ENTRIES_CENTS: number | null = null;
// ARCHITECT-SET: awaiting value — flat bounty per qualified referred player (cents).
export const PLAYER_REFERRAL_BOUNTY_CENTS: number | null = null;
// ARCHITECT-SET: awaiting value — fraction of the field paid out (projection input, 0–1).
export const FIELD_PCT_PAID: number | null = null;

/* ── CHAMPIONSHIP (surfaces slice) ────────────────────────────────────────────── */
/** The four Championship divisions by entry tier — architect-given ($5/$10/$25/$50). */
export const CHAMPIONSHIP_DIVISIONS = [
  { tier: 5, label: "$5" },
  { tier: 10, label: "$10" },
  { tier: 25, label: "$25" },
  { tier: 50, label: "$50" },
] as const;
export type ChampionshipTier = (typeof CHAMPIONSHIP_DIVISIONS)[number]["tier"];

// ARCHITECT-SET: awaiting value — the win-rate % that qualifies a player for the Championship.
// While null the Board strip shows division + win rate and "—" for the line (never a placeholder #).
export const QUALIFICATION_LINE: number | null = null;

// ARCHITECT-SET: awaiting value — the season-milestone date (ISO 8601). The milestone trigger card
// stays DISARMED (never fires) while this is null.
export const CHAMPIONSHIP_SEASON_MILESTONE: string | null = null;

/* ── Per-state placeholders (moved here from eligibility/states.ts per slice 6.4) ── */
// ARCHITECT-SET: awaiting value — per-state minimum-age overrides (default 18).
export const STATE_MIN_AGE: Record<string, number> = {};
// ARCHITECT-SET: awaiting value — states that block college-sports questions (default: none).
export const COLLEGE_SPORTS_BLOCKED: string[] = [];
export const DEFAULT_MIN_AGE = 18;
