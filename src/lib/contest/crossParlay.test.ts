import { describe, expect, it } from "vitest";
import {
  parlayMultiplier,
  scoreParlay,
  settleParlays,
  type ParlayInput,
} from "./crossParlay";

describe("parlayMultiplier", () => {
  it("matches the published curve", () => {
    expect(parlayMultiplier(2)).toBe(3);
    expect(parlayMultiplier(5)).toBe(20);
    expect(parlayMultiplier(10)).toBe(150);
    expect(parlayMultiplier(1)).toBe(0);
    expect(parlayMultiplier(11)).toBe(0);
  });
});

describe("scoreParlay", () => {
  it("orders by slate lock time and ignores void picks", () => {
    // Lock order: t1 false, t2 true, t3 true → [F,T,T] = 0 + 10 + 12 = 22.
    const score = scoreParlay([
      { correct: true, lockTimeMs: 2 },
      { correct: false, lockTimeMs: 1 },
      { correct: true, lockTimeMs: 3 },
      { correct: null, lockTimeMs: 4 }, // void → excluded
    ]);
    expect(score).toBeCloseTo(22);
  });

  it("applies the perfect-card bonus over non-void picks", () => {
    // [T,T] = (10 + 12) × 2 = 44.
    expect(
      scoreParlay([
        { correct: true, lockTimeMs: 1 },
        { correct: true, lockTimeMs: 2 },
        { correct: null, lockTimeMs: 3 },
      ]),
    ).toBeCloseTo(44);
  });
});

describe("settleParlays", () => {
  const pick = (correct: boolean | null, lockTimeMs: number) => ({
    correct,
    lockTimeMs,
  });

  it("refunds a parlay left with fewer than 2 valid picks", () => {
    const inputs: ParlayInput[] = [
      {
        id: "x",
        userId: "u",
        entryTier: 5,
        isPaid: true,
        submittedAtMs: 0,
        picks: [pick(true, 1), pick(null, 2)], // one void → 1 valid
      },
    ];
    const { results } = settleParlays(inputs);
    expect(results[0]!.refunded).toBe(true);
    expect(results[0]!.payoutCents).toBe(500); // $5 entry returned
  });

  it("refunds a paid pool under the participant floor", () => {
    const inputs: ParlayInput[] = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      userId: `u${i}`,
      entryTier: 10 as const,
      isPaid: true,
      submittedAtMs: i,
      picks: [pick(i % 2 === 0, 1), pick(true, 2)],
    }));
    const { results, pools } = settleParlays(inputs);
    expect(pools[0]!.refunded).toBe(true);
    expect(results.every((r) => r.refunded && r.payoutCents === 1000)).toBe(true);
  });

  it("pays the top 25% from a rake'd pool when the floor is met", () => {
    const inputs: ParlayInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p${String(i).padStart(2, "0")}`,
      userId: `u${i}`,
      entryTier: 5 as const,
      isPaid: true,
      submittedAtMs: i,
      // First 6 go perfect (2 correct), the rest split → clear ranking.
      picks: [pick(i < 6, 1), pick(true, 2)],
    }));
    const { results, pools } = settleParlays(inputs);
    const pool = pools[0]!;
    expect(pool.refunded).toBe(false);
    expect(pool.grossPoolCents).toBe(20 * 500);
    expect(pool.paidPositions).toBe(5); // round(20 × 0.25)
    const winners = results.filter((r) => r.payoutCents > 0);
    expect(winners.length).toBe(5);
    expect(pool.distributedCents).toBeLessThanOrEqual(pool.prizePoolCents);
  });

  it("pays free parlays in coins", () => {
    const inputs: ParlayInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`,
      userId: `u${i}`,
      entryTier: 5 as const,
      isPaid: false,
      submittedAtMs: i,
      picks: [pick(i < 4, 1), pick(true, 2)],
    }));
    const { results, pools } = settleParlays(inputs);
    expect(pools[0]!.distributedCoins).toBeGreaterThan(0);
    expect(results.some((r) => r.payoutCoins > 0)).toBe(true);
    expect(results.every((r) => r.payoutCents === 0)).toBe(true);
  });
});
