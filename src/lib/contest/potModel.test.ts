/** Slice-4 gate — the pot model (pool-size rake, sliding cut, division projection, $500K cap) and the
 *  games→engine wiring that Lockpick validates. */
import { describe, it, expect } from "vitest";
import { rakeForPool, creatorCut, project, creatorKeep, CREATOR_CUT_CAP_DOLLARS, DIVISIONS } from "./potModel";
import { TONIGHTS_GAMES, enginePlayersFor } from "./games";
import { validateSlate } from "./questionEngine";

describe("pot model", () => {
  it("rake climbs with pool size and caps at 65%", () => {
    expect(rakeForPool(500)).toBe(0.15);
    expect(rakeForPool(3000)).toBe(0.2);
    expect(rakeForPool(8000)).toBe(0.3);
    expect(rakeForPool(10000)).toBeCloseTo(0.4, 5);
    expect(rakeForPool(1e12)).toBe(0.65); // hard cap
  });

  it("creator cut slides 50% → 20% and never below", () => {
    expect(creatorCut(500)).toBe(0.5);
    expect(creatorCut(2_000_000)).toBe(0.2);
    const mid = creatorCut(31623); // ~10^4.5
    expect(mid).toBeLessThan(0.5);
    expect(mid).toBeGreaterThan(0.2);
  });

  it("kept host fee is capped at $500,000/slate", () => {
    expect(CREATOR_CUT_CAP_DOLLARS).toBe(500000);
    const huge = creatorKeep(10_000_000, 3, 5_000_000);
    expect(huge).toBe(500000);
  });

  it("projection returns an entries + pot range for a division", () => {
    const p = project("wolf", 10);
    expect(p.entriesLo).toBeLessThan(p.entriesHi);
    expect(p.potLo).toBeLessThan(p.potHi);
    expect(DIVISIONS.map((d) => d.key)).toContain("wolf");
  });
});

describe("games → engine wiring (Lockpick)", () => {
  it("two players from two selected games publishes; two from one game fails", () => {
    const ids = ["g1", "g2"];
    const byName = new Map(enginePlayersFor(TONIGHTS_GAMES, ids).map((p) => [p.name, p]));
    const ctx = { seasonAverage: "27.1", last3Form: "W-W-L", matchupNote: "pace up" };

    const clean = validateSlate(
      [{ archetype: "cross_game_h2h", players: [byName.get("Luka Dončić")!, byName.get("Stephen Curry")!], context: ctx }],
      ids,
    );
    expect(clean.canPublish).toBe(true);

    const sameGame = validateSlate(
      [{ archetype: "cross_game_h2h", players: [byName.get("Luka Dončić")!, byName.get("LeBron James")!], context: ctx }],
      ids,
    );
    expect(sameGame.canPublish).toBe(false);
    expect(sameGame.legVerdicts[0]!.reason).toBe("two_from_one_game");
  });
});
