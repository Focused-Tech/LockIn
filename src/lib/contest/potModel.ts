/**
 * CREATOR-MODE POT MODEL (slice 4 · "the pot" · slice 5-6 projection).
 *
 * The builder-side preview economy from design/lockin_creator_mode_mockup.html. This is the POOL-SIZE
 * model — rake as a function of pool size, a sliding creator cut, and a division-based projection.
 *
 * IMPORTANT: this is a PREVIEW/PROJECTION only. The LIVE rake that actually settles a slate is the
 * tier-based model in contest/rake.ts + constants.ts (untouched). Every number here rides on the
 * architect placeholders in architectSet.ts and is flagged as such in the UI. All money in dollars
 * (whole-dollar preview), not cents — this is a projection surface, not the settlement path.
 */
import {
  DIVISION_FOLLOWERS,
  CONV_LO,
  CONV_HI,
  CREATOR_CUT_ANCHOR_HIGH,
  CREATOR_CUT_ANCHOR_LOW,
  CREATOR_CUT_CAP_CENTS,
  type Division,
} from "./architectSet";

export const CREATOR_CUT_CAP_DOLLARS = CREATOR_CUT_CAP_CENTS / 100; // $500,000/slate

/** Pool-size rake (house formula, NOT the live tier rake). 40% at $10K, +~6.75% per 10×, cap 65%.
 *  Sub-$10K bands are architect-set placeholders. */
export function rakeForPool(poolDollars: number): number {
  if (poolDollars < 1000) return 0.15;
  if (poolDollars < 5000) return 0.2;
  if (poolDollars < 10000) return 0.3;
  const r = 0.4 + 0.0675 * Math.log10(poolDollars / 10000);
  return Math.min(0.65, r);
}

/** Creator cut slides HIGH (small pools) → LOW (large), on a log10 curve, capped in dollars later. */
export function creatorCut(poolDollars: number): number {
  if (poolDollars <= 1000) return CREATOR_CUT_ANCHOR_HIGH;
  if (poolDollars >= 1_000_000) return CREATOR_CUT_ANCHOR_LOW;
  const t = Math.log10(poolDollars / 1000) / Math.log10(1000);
  return CREATOR_CUT_ANCHOR_HIGH - (CREATOR_CUT_ANCHOR_HIGH - CREATOR_CUT_ANCHOR_LOW) * t;
}

export interface DivisionMeta {
  key: Division;
  name: string;
  followers: number;
  label: string;
}
export const DIVISIONS: DivisionMeta[] = [
  { key: "hawk", name: "Hawk", followers: DIVISION_FOLLOWERS.hawk, label: "Hawk · under 100K" },
  { key: "wolf", name: "Wolf", followers: DIVISION_FOLLOWERS.wolf, label: "Wolf · 100K–500K" },
  { key: "shark", name: "Shark", followers: DIVISION_FOLLOWERS.shark, label: "Shark · 500K–1M" },
  { key: "boss", name: "Boss", followers: DIVISION_FOLLOWERS.boss, label: "Boss · 1M+" },
];

export interface Projection {
  name: string;
  followers: number;
  entriesLo: number;
  entriesHi: number;
  potLo: number;
  potHi: number;
}

/** Projected entries + pot range for a division at a given average wager (FRANK'S FLOOR: ≥1-in-10). */
export function project(divKey: Division, avgWager: number): Projection {
  const d = DIVISIONS.find((x) => x.key === divKey) ?? DIVISIONS[1]!;
  const entriesLo = Math.round(d.followers * CONV_LO);
  const entriesHi = Math.round(d.followers * CONV_HI);
  const potLo = Math.round(entriesLo * avgWager * (1 - rakeForPool(entriesLo * avgWager)));
  const potHi = Math.round(entriesHi * avgWager * (1 - rakeForPool(entriesHi * avgWager)));
  return { name: d.name, followers: d.followers, entriesLo, entriesHi, potLo, potHi };
}

/** The creator's kept host fee at a given entry count + host fee, capped at $500K/slate. */
export function creatorKeep(entries: number, hostFeeDollars: number, poolDollars: number): number {
  return Math.min(CREATOR_CUT_CAP_DOLLARS, Math.round(entries * hostFeeDollars * creatorCut(poolDollars)));
}
