/** Outcome-verification framework: cross-reference independent sources. */

export interface PredictionInput {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  category: string;
  predictionType: "binary" | "over_under";
  overUnderLine: number | null;
  /** AI pre-event priors (0–100), used by the ai-prior baseline source. */
  optionAProbability: number | null;
  optionBProbability: number | null;
}

/** One source's reading of an outcome. `choice: null` = couldn't determine. */
export interface SourceVote {
  source: string;
  choice: "a" | "b" | null;
  /** This source's own confidence in its vote, 0–1. */
  confidence: number;
  /** Human-readable evidence, surfaced to admins on manual review. */
  detail: string;
}

/** A source adapter: declares what it can answer and resolves it. */
export interface VerificationSource {
  name: string;
  supports(input: PredictionInput): boolean;
  /** Resolve the outcome, or return null if it can't (don't throw). */
  resolve(input: PredictionInput): Promise<SourceVote | null>;
}

export interface VerdictPolicy {
  /** Decisive-source quorum required to auto-settle without an authoritative feed. */
  minSources: number;
  /** Aggregate confidence (0–1) required to auto-settle. */
  autoSettleConfidence: number;
}

/** Cross-referenced verdict across all sources for one prediction. */
export interface PredictionVerdict {
  choice: "a" | "b" | null;
  /** Aggregate confidence 0–1. */
  confidence: number;
  /** Fraction of decisive sources backing the chosen side (1 = unanimous). */
  agreement: number;
  votes: SourceVote[];
  /** Names of sources that produced any vote. */
  sources: string[];
  /** True when the verdict meets the policy to settle without human review. */
  autoSettle: boolean;
}
