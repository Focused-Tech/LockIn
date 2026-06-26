import { SCORING } from "@/lib/constants";

/**
 * Score a card from its ordered pick results.
 *
 * Rules:
 *  - {@link SCORING.pointsPerCorrect} points per correct pick.
 *  - Each consecutive correct pick (a streak of length ≥ 2) is multiplied by
 *    {@link SCORING.consecutiveMultiplier} per additional step.
 *  - A perfect card (all correct) multiplies the total by
 *    {@link SCORING.perfectCardBonus}.
 *
 * @param results Ordered list of pick outcomes, true = correct.
 */
export function scoreCard(results: boolean[]): number {
  if (results.length === 0) return 0;

  let total = 0;
  let streak = 0;

  for (const correct of results) {
    if (correct) {
      streak += 1;
      const stepMultiplier =
        streak > 1 ? Math.pow(SCORING.consecutiveMultiplier, streak - 1) : 1;
      total += SCORING.pointsPerCorrect * stepMultiplier;
    } else {
      streak = 0;
    }
  }

  const perfect = results.every(Boolean);
  if (perfect) total *= SCORING.perfectCardBonus;

  return Math.round(total * 100) / 100;
}
