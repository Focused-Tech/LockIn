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
import {
  elapsedFrac,
  spotsFilledAt,
  bestAvailableSpot,
  spotBonusMultiplier,
  resolveSpot,
  fillSchedule,
  MOCK_PLAYERS,
} from "./urgency";
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
    const r = scorePractice([0, 0, 0], [0, 0, 0], 50);
    expect(r.correct).toBe(3);
    expect(r.perfect).toBe(true);
    expect(r.won).toBe(true);
    expect(r.creditedCoins).toBe(50 * PRACTICE_CONFIG.perfectMultiplier[3]!); // 50*8
    expect(r.net).toBe(50 * 8 - 50);
  });
  it("near-miss feedback at one short", () => {
    const r = scorePractice([0, 0, 1], [0, 0, 0], 50);
    expect(r.correct).toBe(2);
    expect(r.message).toContain("So close");
  });
  it("below the win threshold loses the stake", () => {
    expect(winThreshold(5)).toBe(3);
    const r = scorePractice([0, 0, 1, 1, 1], [0, 1, 0, 0, 0], 50);
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

describe("urgency: countdown + spot race (config-driven, capped at 3)", () => {
  const U = PRACTICE_CONFIG.urgency;

  it("never fills more than maxSpots (3) and tracks the fill curve", () => {
    expect(U.maxSpots).toBe(3);
    expect(U.spotFillFracs.length).toBe(U.maxSpots);
    expect(spotsFilledAt(0)).toBe(0);
    expect(spotsFilledAt(U.spotFillFracs[0]!)).toBe(1);
    expect(spotsFilledAt(U.spotFillFracs[1]!)).toBe(2);
    expect(spotsFilledAt(U.spotFillFracs[2]!)).toBe(3);
    expect(spotsFilledAt(1)).toBe(3); // capped — never exceeds 3
  });

  it("the longer you wait, the worse (or gone) your spot", () => {
    expect(bestAvailableSpot(0)).toBe(1); // lock instantly → top spot
    expect(bestAvailableSpot(1)).toBe(2);
    expect(bestAvailableSpot(2)).toBe(3);
    expect(bestAvailableSpot(3)).toBeNull(); // all premium spots gone
  });

  it("spot bonus scales the payout by spot (1.0 when no spot)", () => {
    expect(spotBonusMultiplier(1)).toBe(U.spotBonus[0]);
    expect(spotBonusMultiplier(2)).toBe(U.spotBonus[1]);
    expect(spotBonusMultiplier(3)).toBe(U.spotBonus[2]);
    expect(spotBonusMultiplier(null)).toBe(1);
  });

  it("resolveSpot maps elapsed time → spot + bonus deterministically", () => {
    const start = 0;
    const lock = 1000;
    expect(elapsedFrac(start, lock, 500)).toBeCloseTo(0.5, 5);
    expect(resolveSpot(start, lock, 0)).toEqual({ spot: 1, filled: 0, bonus: U.spotBonus[0] });
    // just past the first fill threshold → spot #1 taken by a mock
    const t1 = U.spotFillFracs[0]! * lock + 1;
    expect(resolveSpot(start, lock, t1).spot).toBe(2);
    // after the last threshold → no premium spot, no bonus
    expect(resolveSpot(start, lock, lock)).toEqual({ spot: null, filled: 3, bonus: 1 });
  });

  it("fill schedule assigns one labeled mock per spot (stable per seed)", () => {
    const a = fillSchedule("contest-123");
    const b = fillSchedule("contest-123");
    expect(a.length).toBe(U.maxSpots);
    expect(a.map((s) => s.spot)).toEqual([1, 2, 3]);
    expect(a.map((s) => s.mock.id)).toEqual(b.map((s) => s.mock.id)); // deterministic
    a.forEach((s) => expect(MOCK_PLAYERS.some((m) => m.id === s.mock.id)).toBe(true));
  });
});

describe("spot bonus applied to scoring (SCORE only, winnings only)", () => {
  it("boosts winnings for a top spot, never the loss", () => {
    const base = scorePractice([0, 0, 0], [0, 0, 0], 50);
    const boosted = scorePractice([0, 0, 0], [0, 0, 0], 50, 1.6);
    expect(boosted.creditedCoins).toBe(Math.round(base.creditedCoins * 1.6));
    expect(boosted.net).toBe(boosted.creditedCoins - 50);
    // A losing card credits 0 regardless of any spot multiplier.
    const lost = scorePractice([0, 0, 1, 1, 1], [0, 1, 0, 0, 0], 50, 1.6);
    expect(lost.creditedCoins).toBe(0);
    expect(lost.net).toBe(-50);
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
