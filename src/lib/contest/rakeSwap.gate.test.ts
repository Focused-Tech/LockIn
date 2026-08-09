/**
 * RAKE SWAP (ruled Jul 28) — settlement is on the ONE pool-size curve; the tier table is retired.
 * Asserts each MUST-NOT-CHANGE invariant:
 *   · coin/free pool settles with NO rake (rake is inside the isPaid branch only);
 *   · the Fox Pit tower calls no rake function;
 *   · MEGA_RAKE + computeRake are RETIRED (gone from code, not repurposed);
 *   · Championship rake (78% cap) is a separate path, intact;
 *   · rake is never displayed on a player/creator surface;
 *   · the sub-$10K bands live in architectSet, and preview == settlement across the curve.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { poolSizeRate, poolSizeRake } from "./poolRake";
import { rakeForPool } from "./potModel";
import { SUB_10K_RAKE_BANDS } from "./architectSet";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const has = (p: string) => existsSync(resolve(process.cwd(), p));

describe("the curve — bands from architectSet; preview == settlement", () => {
  it("sub-$10K bands are the ruled 15/20/30 in architectSet (not inlined)", () => {
    expect(SUB_10K_RAKE_BANDS.map((b) => b.rate)).toEqual([0.15, 0.2, 0.3]);
    expect(SUB_10K_RAKE_BANDS.map((b) => b.belowCents)).toEqual([100_000, 500_000, 1_000_000]);
    expect(read("src/lib/contest/poolRake.ts")).toContain("SUB_10K_RAKE_BANDS.find");
  });
  it("the curve matches the ruling and settlement == preview at every pool", () => {
    const rows: [number, number][] = [
      [5_000_00, 0.3], [10_000_00, 0.4], [100_000_00, 0.4675], [1_000_000_00, 0.535],
    ];
    for (const [cents, rate] of rows) {
      expect(poolSizeRate(cents)).toBeCloseTo(rate, 6);
      // rakeForPool(dollars) is the SAME function → identical raked cents.
      expect(Math.floor(cents * rakeForPool(cents / 100))).toBe(poolSizeRake(cents).rakeCents);
    }
    expect(poolSizeRate(1e14)).toBe(0.65); // hard cap
  });
  it("Championship rake is a separate path — 78% cap, intact and untouched", () => {
    expect(poolSizeRate(1e14, true)).toBe(0.78);
    expect(poolSizeRate(1e14, false)).toBe(0.65);
  });
});

describe("must-not-change", () => {
  it("the coin/free pool takes NO rake — poolSizeRake sits inside the isPaid branch only", () => {
    const s = read("src/lib/contest/settlement.ts");
    const rakeIdx = s.indexOf("poolSizeRake(grossPoolCents)");
    const paidIdx = s.indexOf("if (isPaid && tier)");
    expect(paidIdx).toBeGreaterThan(-1);
    expect(rakeIdx).toBeGreaterThan(paidIdx); // rake only after the paid gate
    // the free branch pays coins with no rake
    expect(s).toContain('key = e.isPaid ? `paid:${e.entryTier}` : "free"');
  });
  it("the Fox Pit tower calls no rake function", () => {
    const fox = read("src/app/app/foxpit/room/[room]/FoxPitGame.tsx");
    expect(/poolSizeRake\(|computeRake\(|rakeForPool\(/.test(fox)).toBe(false);
  });
  it("MEGA_RAKE and computeRake are RETIRED — gone from code, rake.ts deleted", () => {
    expect(has("src/lib/contest/rake.ts")).toBe(false);
    const constants = read("src/lib/constants.ts");
    expect(/export const MEGA_RAKE\b/.test(constants)).toBe(false);
    expect(/export const RAKE_TIERS\b/.test(constants)).toBe(false);
    // no computeRake definition or call survives in the tree
    for (const f of ["src/lib/contest/settlement.ts", "src/lib/contest/metrics.ts", "src/lib/contest/crossParlay.ts", "src/lib/contest/index.ts"]) {
      expect(read(f).includes("computeRake")).toBe(false);
    }
  });
  it("rake is never displayed on a player/creator surface", () => {
    for (const f of ["src/app/app/slate/[id]/SlatePicker.tsx", "src/components/feed/SlateCard.tsx"]) {
      expect(/rake/i.test(read(f))).toBe(false);
    }
  });
});
