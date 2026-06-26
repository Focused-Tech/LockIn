import type { EntryTier } from "./constants";

/** Lifecycle of a contest slate. */
export type SlateStatus = "draft" | "open" | "live" | "locked" | "settled" | "cancelled";

/** Prediction question shapes. */
export type PredictionType = "binary" | "over_under";

/** A single outcome option a user can pick. */
export interface PredictionOption {
  id: string;
  label: string;
  /** AI/community probability (0–1). */
  probability: number;
}

/** A prediction question within a slate. */
export interface Prediction {
  id: string;
  type: PredictionType;
  question: string;
  options: PredictionOption[];
  /** AI-set line for over/under questions. */
  line?: number;
}

/** Money is always cents (integer). This brand documents intent. */
export type Cents = number;

/** Result of resolving the rake for a pool. */
export interface RakeResult {
  tier: EntryTier;
  rateApplied: number;
  rakeCents: Cents;
  prizePoolCents: Cents;
}

/** A computed payout for a single finishing rank. */
export interface RankPayout {
  rank: number;
  shareApplied: number;
  grossCents: Cents;
  /** Amount after applying the 1,000x cap. */
  payoutCents: Cents;
  /** Cap overflow that flows to LockIn revenue. */
  overflowCents: Cents;
}
