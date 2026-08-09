/**
 * DEMO SLATES — demos are NOT exempt from the validator (P). Every demo leg must pass the same
 * banned-shape check the seed + entry paths use, and demos open at canon length (5–6 legs).
 */
import { describe, it, expect } from "vitest";
import { firstBannedLeg } from "@/lib/contest/questionEngine";
import { DEMO_SLATES, DEMO_START_LEGS, buildDemoPredictions } from "@/lib/demoSlates";

describe("demo slates pass the banned-shape validator", () => {
  it("no leg in any demo slate is a banned shape", () => {
    for (const s of DEMO_SLATES) {
      const banned = firstBannedLeg(
        s.predictions.map((p) => ({ question: p.question, optionA: p.optionA, optionB: p.optionB, type: p.type })),
      );
      expect(banned, `${s.id}: ${banned?.question} (${banned?.archetype})`).toBeNull();
    }
  });

  it("no rotated demo set produces a banned leg either", () => {
    for (const id of ["demo-nba", "demo-bet"]) {
      const { predictions } = buildDemoPredictions(id, 6, []);
      const banned = firstBannedLeg(
        predictions.map((p) => ({ question: p.question, optionA: p.optionA, optionB: p.optionB, type: p.type })),
      );
      expect(banned, `${id}: ${banned?.question}`).toBeNull();
    }
  });

  it("demos open at canon length (5–6 legs)", () => {
    expect(DEMO_START_LEGS).toBeGreaterThanOrEqual(5);
    for (const s of DEMO_SLATES) expect(s.predictions.length).toBeGreaterThanOrEqual(5);
  });
});
