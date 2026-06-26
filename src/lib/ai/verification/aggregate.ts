import { AI_PRIOR_SOURCE } from "./sources/aiPrior";
import type { PredictionVerdict, SourceVote, VerdictPolicy } from "./types";

/**
 * Cross-reference source votes into a single verdict (pure / testable).
 *
 * - The winning side is the one with the greater summed source confidence.
 * - Aggregate confidence = the strongest agreeing source, scaled by agreement
 *   (any dissent drops it), so a lone weak guess never reads as certain.
 * - Auto-settle requires zero conflicts, confidence ≥ the policy threshold, and
 *   EITHER one authoritative (non-AI-prior) source OR a quorum of decisive
 *   sources — so pure-AI guesses are routed to manual review.
 */
export function aggregateVotes(
  votes: SourceVote[],
  policy: VerdictPolicy,
): PredictionVerdict {
  const sources = votes.map((v) => v.source);
  const decisive = votes.filter((v) => v.choice === "a" || v.choice === "b");

  if (decisive.length === 0) {
    return { choice: null, confidence: 0, agreement: 0, votes, sources, autoSettle: false };
  }

  const weight = (side: "a" | "b") =>
    decisive
      .filter((v) => v.choice === side)
      .reduce((sum, v) => sum + v.confidence, 0);

  const choice: "a" | "b" = weight("a") >= weight("b") ? "a" : "b";
  const backers = decisive.filter((v) => v.choice === choice);
  const conflicting = decisive.length - backers.length;
  const agreement = backers.length / decisive.length;
  const confidence = Math.max(...backers.map((v) => v.confidence)) * agreement;
  const authoritative = backers.filter((v) => v.source !== AI_PRIOR_SOURCE);

  const autoSettle =
    conflicting === 0 &&
    confidence >= policy.autoSettleConfidence &&
    (authoritative.length >= 1 || decisive.length >= policy.minSources);

  return { choice, confidence, agreement, votes, sources, autoSettle };
}
