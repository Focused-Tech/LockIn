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

/* ── Sub-$10K rake bands (slice 6.4) — mockup pool-size model ONLY, NOT the live rake ── */
// ARCHITECT-SET: awaiting value — thresholds for the sub-$10K rake bands IF the pool-size rake
// model is adopted. The live rake (contest/rake.ts) is tier-based and untouched.
export const SUB_10K_RAKE_BANDS: { belowCents: number; rate: number }[] = [];

/* ── Sport key (used by the stats provider + creator games) ──────────────────── */
// The composite scoring WEIGHTS that used to live here were Claude's invention, not the architect's,
// and have been removed. Cross-game settlement compares players on the `composite` already carried by
// resolveArchetype (contest/archetypes.ts) — no weighting formula, no placeholder to fill.
export type ScoringSport = "basketball" | "football" | "baseball" | "hockey" | "soccer";

/* ── Per-state placeholders (moved here from eligibility/states.ts per slice 6.4) ── */
// ARCHITECT-SET: awaiting value — per-state minimum-age overrides (default 18).
export const STATE_MIN_AGE: Record<string, number> = {};
// ARCHITECT-SET: awaiting value — states that block college-sports questions (default: none).
export const COLLEGE_SPORTS_BLOCKED: string[] = [];
export const DEFAULT_MIN_AGE = 18;
