/**
 * SLICE 1.1 — STATE ELIGIBILITY CONFIG.
 *
 * ONE ROW PER STATE, four columns: cashAllowed · formatTier · collegeSportsAllowed · minAge.
 * Served states change with little warning — this is a TABLE EDIT, never code: to pull cash from
 * a state, add its code to CASH_BLOCKED; to restrict its format, add it to RESTRICTED_FORMAT.
 *
 * Do NOT scatter these checks — resolve everything through `resolveEligibility` (./index.ts).
 */
// Per-state min-age + college-sports lists live in the ONE placeholder file (slice 6.4).
import { STATE_MIN_AGE, COLLEGE_SPORTS_BLOCKED, DEFAULT_MIN_AGE } from "@/lib/contest/architectSet";

export type FormatTier = "standard" | "restricted";

export interface StateConfig {
  /** false = coins only in this state (real-money entry + hosting blocked). Everything else unlocked. */
  cashAllowed: boolean;
  /** which question pool the user sees. RESTRICTED = CA/FL tighter set (slice 2.4). */
  formatTier: FormatTier;
  /** ARCHITECT-SET PLACEHOLDER — per-state college-sports bans need Frank's list. Default allowed. */
  collegeSportsAllowed: boolean;
  /** ARCHITECT-SET PLACEHOLDER — per-state minimum age. Default 18; 21-states need Frank's list. */
  minAge: number;
}

/** All US states + DC — one row per state is generated from the overrides below. */
export const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR",
  "PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
export type StateCode = (typeof ALL_STATES)[number];

/**
 * NOT SERVED (cash) — coins only, everything else unlocked. HI/ID/MT/NV/WA by state law; NY until
 * further notice (do NOT build NY licensing). EDIT THIS LIST to change served states.
 */
export const CASH_BLOCKED: StateCode[] = ["HI", "ID", "MT", "NV", "WA", "NY"];

/** RESTRICTED FORMAT — sees the tighter question pool (slice 2.4). */
export const RESTRICTED_FORMAT: StateCode[] = ["CA", "FL"];

/** The generated one-row-per-state table. Import this (or, preferably, the resolver). */
export const STATE_CONFIG: Record<StateCode, StateConfig> = Object.fromEntries(
  ALL_STATES.map((s) => [
    s,
    {
      cashAllowed: !CASH_BLOCKED.includes(s),
      formatTier: RESTRICTED_FORMAT.includes(s) ? "restricted" : "standard",
      collegeSportsAllowed: !COLLEGE_SPORTS_BLOCKED.includes(s),
      minAge: STATE_MIN_AGE[s] ?? DEFAULT_MIN_AGE,
    },
  ]),
) as Record<StateCode, StateConfig>;

/** Human-readable state-law note for the blocked-state message (slice 1.5). */
export const CASH_BLOCK_REASON: Partial<Record<StateCode, string>> = {
  HI: "Hawaii law does not permit paid skill-based prediction contests.",
  ID: "Idaho law does not permit paid skill-based prediction contests.",
  MT: "Montana restricts paid contests to licensed operators.",
  NV: "Nevada routes paid contests through its gaming-licensing regime.",
  WA: "Washington law prohibits paid online prediction contests.",
  NY: "New York paid contests are paused pending licensing — not available until further notice.",
};
