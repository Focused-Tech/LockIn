import {
  AUTO_SETTLE_CONFIDENCE,
  MIN_VERIFICATION_SOURCES,
} from "@/lib/constants";
import { aggregateVotes } from "./aggregate";
import { aiPriorSource } from "./sources/aiPrior";
import { coingeckoSource } from "./sources/coingecko";
import { espnSource } from "./sources/espn";
import type {
  PredictionInput,
  PredictionVerdict,
  VerdictPolicy,
  VerificationSource,
} from "./types";

/** Registered sources, most authoritative first. Add adapters here. */
export const SOURCES: VerificationSource[] = [
  espnSource,
  coingeckoSource,
  aiPriorSource,
];

const DEFAULT_POLICY: VerdictPolicy = {
  minSources: MIN_VERIFICATION_SOURCES,
  autoSettleConfidence: AUTO_SETTLE_CONFIDENCE,
};

/**
 * Verify one prediction by cross-referencing every applicable source, then
 * aggregating into a verdict. Source errors are swallowed (treated as no vote)
 * so one flaky feed never blocks settlement.
 */
export async function verifyPrediction(
  input: PredictionInput,
  policy: VerdictPolicy = DEFAULT_POLICY,
): Promise<PredictionVerdict> {
  const applicable = SOURCES.filter((s) => s.supports(input));
  const votes = (
    await Promise.all(
      applicable.map((s) => s.resolve(input).catch(() => null)),
    )
  ).filter((v) => v !== null);
  return aggregateVotes(votes, policy);
}

export type { PredictionInput, PredictionVerdict } from "./types";
