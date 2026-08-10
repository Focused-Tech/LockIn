/**
 * DEMO SLATES — demos are NOT exempt from the validator (P). Every demo leg must pass the same
 * banned-shape check the seed + entry paths use, and demos open at canon length (5–6 legs).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstBannedLeg } from "@/lib/contest/questionEngine";
import { DEMO_SLATES, DEMO_START_LEGS, buildDemoPredictions } from "@/lib/demoSlates";
import { formatCoinsShort } from "@/lib/utils";

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

describe("demos show COINS, never $ (Part 4) — live slates keep dollars", () => {
  const read = (p: string) =>
    readFileSync(resolve(process.cwd(), p), "utf8");

  it("formatCoinsShort converts cents→coins (×10) with the 🪙 token", () => {
    // $5.10 pool → 5,100¢ → 51,000 coins (whole-number k drops the .0, like formatCentsShort).
    expect(formatCoinsShort(510_0)).toBe("🪙 51k");
    expect(formatCoinsShort(50)).toBe("🪙 500");
    // it is a coin token, never a dollar sign
    expect(formatCoinsShort(999_99)).not.toContain("$");
  });

  it("every DEMO_SLATE carries isDemo — the flag both surfaces branch on", () => {
    for (const s of DEMO_SLATES) expect(s.isDemo).toBe(true);
  });

  it("the demo player + feed card branch the pool/1st-place figure on the demo flag", () => {
    const picker = read("src/app/app/slate/[id]/SlatePicker.tsx");
    expect(picker).toContain("isDemo ? formatCoinsShort(metrics.prizePoolCents)");
    expect(picker).toContain("isDemo ? formatCoinsShort(metrics.firstPlaceCents)");
    const card = read("src/components/feed/SlateCard.tsx");
    expect(card).toContain("demo ? formatCoinsShort : formatCentsShort");
    // live path still exists — dollars are NOT globally removed
    expect(card).toContain("formatCentsShort");
  });
});
