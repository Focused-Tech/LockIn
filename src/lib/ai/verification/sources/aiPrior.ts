import type { VerificationSource } from "../types";

export const AI_PRIOR_SOURCE = "ai-prior";

/**
 * Baseline source: the AI pre-event probabilities. Always votes (the favorite),
 * but as a non-authoritative source it can't auto-settle on its own — it only
 * corroborates a real data feed or contributes to a multi-source quorum.
 */
export const aiPriorSource: VerificationSource = {
  name: AI_PRIOR_SOURCE,
  supports: () => true,
  async resolve(input) {
    const a = input.optionAProbability ?? 50;
    const b = input.optionBProbability ?? 50;
    const choice = a >= b ? "a" : "b";
    const pct = Math.max(a, b);
    return {
      source: AI_PRIOR_SOURCE,
      choice,
      confidence: pct / 100,
      detail: `AI prior favored "${choice === "a" ? input.optionA : input.optionB}" at ${pct}%`,
    };
  },
};
