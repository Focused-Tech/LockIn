import { describe, expect, it } from "vitest";
import { resultFor, winUpTo } from "./payoutModel";

/**
 * Locks the beginner tunable model to the design-spec demo math
 * (design/lockin-beginner-journey.html). These are placeholder economics, not
 * real settlement — the test guards that the isolated module keeps reproducing
 * the spec values if anyone retunes it.
 */
describe("beginner payoutModel", () => {
  it("win-up-to follows MULT × stake", () => {
    expect(winUpTo(50, 1)).toBe(120); // 50 × 2.4
    expect(winUpTo(50, 2)).toBe(290); // 50 × 5.8
    expect(winUpTo(50, 3)).toBe(600); // 50 × 12
    expect(winUpTo(50, 4)).toBe(1200); // 50 × 24
  });

  it("single all-correct pick misses the paid line", () => {
    const r = resultFor(50, 1, 1);
    expect(r.paid).toBe(false);
    expect(r.creditedCoins).toBe(0);
    expect(r.coinNet).toBe(-50);
    expect(r.cashNet).toBe(-5); // two-way shadow: a $5 cash entry would have lost
  });

  it("3-leg perfect pays the full win-up-to (+ two-way cash win)", () => {
    const r = resultFor(50, 3, 3);
    expect(r.pct).toBe(9);
    expect(r.paid).toBe(true);
    expect(r.creditedCoins).toBe(600);
    expect(r.coinNet).toBe(550);
    expect(r.cashNet).toBeCloseTo(55, 5);
  });

  it("3-leg with one miss still pays a partial share when inside the line", () => {
    const r = resultFor(50, 3, 2);
    expect(r.pct).toBe(27); // 9 + 18
    expect(r.paid).toBe(true);
    expect(r.creditedCoins).toBe(300); // 600 × 0.5
    expect(r.coinNet).toBe(250);
    expect(r.cashNet).toBeCloseTo(25, 5);
  });

  it("two misses slides outside the paid line (coin + cash loss)", () => {
    const r = resultFor(50, 3, 1);
    expect(r.pct).toBe(45); // 9 + 36
    expect(r.paid).toBe(false);
    expect(r.creditedCoins).toBe(0);
    expect(r.coinNet).toBe(-50);
    expect(r.cashNet).toBe(-5);
  });
});
