import { describe, expect, it } from "vitest";
import { recommendSlates, type RecSignals, type RecSlate } from "./engine";

const NOW = 1_000_000_000_000;
const slate = (over: Partial<RecSlate> & { id: string }): RecSlate => ({
  category: "NBA",
  creatorId: "c-x",
  tiers: [5, 10, 25],
  entryCount: 0,
  lockTimeMs: NOW + 24 * 60 * 60 * 1000,
  ...over,
});

const EMPTY: RecSignals = {
  categoryWinRates: {},
  categoryPlays: {},
  followedCreators: [],
  tierCounts: {},
};

describe("recommendSlates", () => {
  const four = [
    slate({ id: "a", entryCount: 5 }),
    slate({ id: "b", entryCount: 50, category: "Esports" }),
    slate({ id: "c", entryCount: 20, creatorId: "c-follow" }),
    slate({ id: "d", entryCount: 1 }),
  ];

  it("cold start ranks by entry count and reads 'Popular right now'", () => {
    const recs = recommendSlates(four, EMPTY, NOW);
    expect(recs[0]!.slate.id).toBe("b"); // highest entry count
    expect(recs.every((r) => r.reason === "Popular right now")).toBe(true);
  });

  it("surfaces followed creators with the right reason", () => {
    const recs = recommendSlates(four, { ...EMPTY, followedCreators: ["c-follow"] }, NOW);
    expect(recs[0]!.slate.id).toBe("c");
    expect(recs[0]!.reason).toBe("From a creator you follow");
  });

  it("surfaces category affinity with a category reason", () => {
    const recs = recommendSlates(
      four,
      {
        ...EMPTY,
        categoryPlays: { Esports: 8 },
        categoryWinRates: { Esports: 80 },
      },
      NOW,
    );
    expect(recs[0]!.slate.id).toBe("b");
    expect(recs[0]!.reason).toBe("Based on your Esports picks");
  });

  it("falls back to chronological (no reason) below the result floor", () => {
    const two = [
      slate({ id: "x", lockTimeMs: NOW + 2000 }),
      slate({ id: "y", lockTimeMs: NOW + 1000 }),
    ];
    const recs = recommendSlates(two, { ...EMPTY, followedCreators: ["c-x"] }, NOW);
    expect(recs.map((r) => r.slate.id)).toEqual(["y", "x"]); // by lock time
    expect(recs.every((r) => r.reason === null)).toBe(true);
  });
});
