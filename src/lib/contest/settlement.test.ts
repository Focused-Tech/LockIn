import { describe, it, expect } from "vitest";
import { scoreCard } from "./scoring";
import {
  settleEntries,
  type SettlementEntryInput,
} from "./settlement";
import type { EntryTier } from "@/lib/constants";

const results: Record<string, "a" | "b"> = { p1: "a" };
const order = ["p1"];

/** N entries, all correct, submitted in index order (entry 0 is earliest). */
function makeEntries(
  n: number,
  opts: { tier?: EntryTier; hostingFeeCents?: number; isPaid?: boolean } = {},
): SettlementEntryInput[] {
  const { tier = 5, hostingFeeCents = 100, isPaid = true } = opts;
  return Array.from({ length: n }, (_, i) => ({
    id: `e${String(i).padStart(6, "0")}`,
    userId: `u${i}`,
    entryTier: tier,
    hostingFeeCents,
    isPaid,
    submittedAtMs: i,
    picks: [{ predictionId: "p1", choice: "a" as const }],
  }));
}

function rank1(entries: SettlementEntryInput[]) {
  const { entries: out } = settleEntries(entries, results, order);
  return out.find((e) => e.rank === 1)!;
}

describe("scoreCard", () => {
  it("scores correct picks, streaks, and the perfect-card bonus", () => {
    expect(scoreCard([])).toBe(0);
    expect(scoreCard([true])).toBe(20); // single correct = perfect → 10 × 2
    expect(scoreCard([true, false, true])).toBe(20); // streak resets, not perfect
    // 3 correct: 10 + 12 + 14.4 = 36.4, perfect ×2 = 72.8
    expect(scoreCard([true, true, true])).toBe(72.8);
  });
});

describe("settleEntries — 1st-place cash matches the spec's honest multiples", () => {
  // $5 tier, $1 hosting → $6 total entry. Figures from HANDOFF.md.
  it.each([
    [20, 1020], // $10.20
    [100, 5100], // $51
    [500, 25500], // $255
    [1000, 51000], // $510
    [10000, 510000], // $5,100
  ])("%i entries → 1st wins %i cents", (n, expected) => {
    expect(rank1(makeEntries(n)).payoutCents).toBe(expected);
  });

  it("applies the 1,000× cap (12,000 entries → capped at $6,000)", () => {
    const winner = rank1(makeEntries(12000));
    expect(winner.payoutCents).toBe(600000); // $6 × 1000
  });
});

describe("settleEntries — eligibility, top-25%, tiebreak", () => {
  it("refunds entry + hosting when under the 20-participant minimum", () => {
    const { entries, groups } = settleEntries(makeEntries(10), results, order);
    expect(groups[0]!.refunded).toBe(true);
    for (const e of entries) {
      expect(e.refunded).toBe(true);
      expect(e.payoutCents).toBe(600); // $5 + $1 hosting
    }
  });

  it("pays only the top 25% (rank 26 of 100 gets nothing)", () => {
    const { entries } = settleEntries(makeEntries(100), results, order);
    expect(entries.find((e) => e.rank === 25)!.payoutCents).toBeGreaterThan(0);
    expect(entries.find((e) => e.rank === 26)!.payoutCents).toBe(0);
  });

  it("breaks score ties by earlier submission", () => {
    const entries = makeEntries(20);
    // Give a later entry an earlier timestamp; it should take rank 1.
    entries[5]!.submittedAtMs = -1;
    const { entries: out } = settleEntries(entries, results, order);
    expect(out.find((e) => e.rank === 1)!.id).toBe(entries[5]!.id);
  });

  it("Card Rush boosts the prize pool by the multiplier", () => {
    // 100 entries, $5 tier, 2x: base pool $425 → boosted $850; 1st = 12% = $102
    const { entries } = settleEntries(makeEntries(100), results, order, {
      prizeMultiplier: 2,
    });
    expect(entries.find((e) => e.rank === 1)!.payoutCents).toBe(10200);
  });

  it("Card Rush still respects the 1,000x cap", () => {
    const { entries } = settleEntries(makeEntries(12000), results, order, {
      prizeMultiplier: 2,
    });
    expect(entries.find((e) => e.rank === 1)!.payoutCents).toBe(600000);
  });

  it("Card Rush boosts free-tier coin payouts too", () => {
    // 20 free entries, 2x: coin pool 20×100×2 = 4000; 1st = 12% = 480 coins
    const { entries } = settleEntries(
      makeEntries(20, { isPaid: false }),
      results,
      order,
      { prizeMultiplier: 2 },
    );
    expect(entries.find((e) => e.rank === 1)!.payoutCoins).toBe(480);
  });

  it("pays the free tier in coins via the same curve", () => {
    const { entries, groups } = settleEntries(
      makeEntries(20, { isPaid: false }),
      results,
      order,
    );
    // coin pool = 20 × 100 = 2000; 1st = 12% → 240 coins
    expect(groups[0]!.isPaid).toBe(false);
    expect(entries.find((e) => e.rank === 1)!.payoutCoins).toBe(240);
  });
});
