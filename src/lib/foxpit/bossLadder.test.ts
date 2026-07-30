/**
 * STAGE 2 GATE — the floor ladder resolves an opponent at every step: each underling table, THEN the
 * 2nd-tier encounter (Ghost/Grim), THEN the floor boss. Coliseum = 4 tables + Ghost + Wolf; High
 * Table = 3 tables + Grim + Raven. Best-of match targets: table/2nd-tier 2, boss 3.
 * (Room-clear-only-on-boss + the unlock chain live in Room.tsx and are device-verified.)
 */
import { describe, it, expect } from "vitest";
import { underlingAt, underlingTableCount, secondTierOf, hasSecondTier } from "./underlings";
import { ROOM_RULES, winsNeeded, maxHands } from "./rules";

function ladder(room: "coliseum" | "hightable" | "dojo" | "suite"): string[] {
  const names: string[] = [];
  for (let i = 0; i < underlingTableCount(room); i++) names.push(underlingAt(room, i)!.name);
  const st = secondTierOf(room);
  if (st) names.push(`2ND:${st.name}`);
  names.push(`BOSS:${ROOM_RULES[room].boss}`);
  return names;
}

describe("Stage 2 — floor ladder resolution", () => {
  it("coliseum: 4 underling tables → Ghost (2nd-tier) → Alpha Wolf", () => {
    expect(ladder("coliseum")).toEqual(["Runt", "Luna", "Scout", "Fang", "2ND:Ghost", "BOSS:Alpha Wolf"]);
    expect(underlingTableCount("coliseum")).toBe(4);
    expect(underlingAt("coliseum", 4)).toBeNull(); // Ghost is the 2nd-tier encounter, not a table seat
    expect(hasSecondTier("coliseum")).toBe(true);
  });
  it("hightable: 3 underling tables → Grim (2nd-tier) → Boss Raven", () => {
    expect(ladder("hightable")).toEqual(["Omen", "Hex", "Pica", "2ND:Grim", "BOSS:Boss Raven"]);
    expect(underlingTableCount("hightable")).toBe(3);
    expect(underlingAt("hightable", 3)).toBeNull();
    expect(secondTierOf("hightable")!.name).toBe("Grim");
  });
  it("single-table rooms: the one table IS the boss, no 2nd-tier", () => {
    expect(underlingTableCount("dojo")).toBe(0);
    expect(underlingTableCount("suite")).toBe(0);
    expect(hasSecondTier("dojo")).toBe(false);
    expect(secondTierOf("suite")).toBeNull();
  });
  it("best-of match structure: table/2nd-tier best 2-of-3, boss best 3-of-5", () => {
    expect(winsNeeded(false)).toBe(2);
    expect(maxHands(false)).toBe(3);
    expect(winsNeeded(true)).toBe(3);
    expect(maxHands(true)).toBe(5);
  });
});
