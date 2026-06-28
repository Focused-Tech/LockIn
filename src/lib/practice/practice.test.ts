import { describe, expect, it } from "vitest";
import { rankForCoins, difficultyForTier, PRACTICE_TIERS } from "./tiers";
import {
  scorePractice,
  winThreshold,
  isBusted,
  scheduledRefillAt,
  claimRefill,
  PRACTICE_REFILL_COOLDOWN_MS,
} from "./scoring";
import { PRACTICE_CONFIG } from "./config";

describe("practice rank tiers (config-driven)", () => {
  it("derives tier boundaries from config", () => {
    expect(rankForCoins(0).tier.key).toBe("rookie");
    expect(rankForCoins(999).tier.key).toBe("rookie");
    expect(rankForCoins(1_000).tier.key).toBe("sharp");
    expect(rankForCoins(4_999).tier.key).toBe("sharp");
    expect(rankForCoins(5_000).tier.key).toBe("pro");
    expect(rankForCoins(24_999).tier.key).toBe("pro");
    expect(rankForCoins(25_000).tier.key).toBe("elite");
    expect(rankForCoins(99_999).tier.key).toBe("elite");
    expect(rankForCoins(100_000).tier.key).toBe("legend");
    expect(rankForCoins(5_000).tier.max).toBe(24_999); // next.min - 1
  });

  it("reports progress toward the next tier", () => {
    const r = rankForCoins(2_500); // sharp: 1000..4999
    expect(r.next?.key).toBe("pro");
    expect(r.toNext).toBe(2_500);
    expect(r.progress).toBeCloseTo((2_500 - 1_000) / (5_000 - 1_000), 5);
    expect(rankForCoins(120_000).next).toBeNull(); // Legend is terminal
  });
});

describe("dynamic difficulty (target win-rate band)", () => {
  it("uses base leg count without recent data", () => {
    expect(difficultyForTier("rookie").legs).toBe(3);
    expect(difficultyForTier("pro").legs).toBe(5);
    expect(difficultyForTier("legend").legs).toBe(7);
  });
  it("nudges harder when winning above the band, easier when below", () => {
    // Elite band [5,6]: winning a lot -> +1 (6), busting -> -1 (5)
    expect(difficultyForTier("elite", PRACTICE_CONFIG.winRateBand.high + 0.1).legs).toBe(6);
    expect(difficultyForTier("elite", PRACTICE_CONFIG.winRateBand.low - 0.1).legs).toBe(5);
    // Rookie is clamped to [3,3] regardless
    expect(difficultyForTier("rookie", 0.9).legs).toBe(3);
    expect(difficultyForTier("rookie", 0.1).legs).toBe(3);
  });
});

describe("instant scoring (coins are score)", () => {
  it("pays the full win-up-to on a perfect card", () => {
    const r = scorePractice(["a", "a", "a"], ["a", "a", "a"], 50);
    expect(r.correct).toBe(3);
    expect(r.perfect).toBe(true);
    expect(r.won).toBe(true);
    expect(r.creditedCoins).toBe(50 * PRACTICE_CONFIG.perfectMultiplier[3]!); // 50*8
    expect(r.net).toBe(50 * 8 - 50);
  });
  it("near-miss feedback at one short", () => {
    const r = scorePractice(["a", "a", "b"], ["a", "a", "a"], 50);
    expect(r.correct).toBe(2);
    expect(r.message).toContain("So close");
  });
  it("below the win threshold loses the stake", () => {
    expect(winThreshold(5)).toBe(3);
    const r = scorePractice(["a", "a", "b", "b", "b"], ["a", "b", "a", "a", "a"], 50);
    expect(r.won).toBe(false);
    expect(r.creditedCoins).toBe(0);
    expect(r.net).toBe(-50);
  });
  it("tier count matches the spec (5 tiers)", () => {
    expect(PRACTICE_TIERS.map((t) => t.key)).toEqual([
      "rookie", "sharp", "pro", "elite", "legend",
    ]);
  });
});

describe("daily refill (wait, not instant; never buyable)", () => {
  const STAKE = PRACTICE_CONFIG.coins.defaultStake;
  const now = 1_000_000_000_000;

  it("busted = can't afford the minimum stake", () => {
    expect(isBusted(STAKE)).toBe(false);
    expect(isBusted(STAKE - 1)).toBe(true);
    expect(isBusted(0)).toBe(true);
  });

  it("schedules the refill one cooldown out when busted (sticky)", () => {
    expect(scheduledRefillAt(500, null, now)).toBeNull(); // not busted
    expect(scheduledRefillAt(0, null, now)).toBe(now + PRACTICE_REFILL_COOLDOWN_MS);
    // sticky: keeps the existing time, doesn't push it out
    expect(scheduledRefillAt(0, now + 5, now)).toBe(now + 5);
  });

  it("does NOT refill before the cooldown elapses", () => {
    const c = claimRefill(0, now + PRACTICE_REFILL_COOLDOWN_MS, now);
    expect(c.refilled).toBe(false);
    expect(c.coins).toBe(0);
  });

  it("refills to 500 once the cooldown has elapsed", () => {
    const c = claimRefill(0, now - 1, now);
    expect(c.refilled).toBe(true);
    expect(c.coins).toBe(PRACTICE_CONFIG.coins.refillTo);
    expect(c.refillAt).toBeNull();
  });

  it("cooldown is config-driven (24h default)", () => {
    expect(PRACTICE_REFILL_COOLDOWN_MS).toBe(24 * 3_600_000);
  });
});
