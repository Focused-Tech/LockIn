/**
 * C GATE — the floor-boss ladder resolves an opponent at every step by name: each underling table,
 * then the floor boss at the throne. (Pure resolution; the room-clear-only-on-boss wiring lives in
 * Room.tsx onCleared and is grep-proven + device-verified.)
 */
import { describe, it, expect } from "vitest";
import { underlingAt, underlingTableCount } from "./underlings";
import { ROOM_RULES } from "./rules";

function ladder(room: "coliseum" | "hightable" | "dojo" | "suite"): string[] {
  const names: string[] = [];
  for (let i = 0; i < underlingTableCount(room); i++) names.push(underlingAt(room, i)!.name);
  names.push(`BOSS:${ROOM_RULES[room].boss}`);
  return names;
}

describe("C — boss ladder resolution", () => {
  it("coliseum: 5 underling tables → Alpha Wolf at the throne", () => {
    expect(ladder("coliseum")).toEqual(["Runt", "Luna", "Scout", "Fang", "Vixen", "BOSS:Alpha Wolf"]);
    expect(underlingAt("coliseum", 5)).toBeNull(); // no 6th table — Ghost is not seated
  });
  it("hightable: 4 underling tables → Boss Raven at the throne", () => {
    expect(ladder("hightable")).toEqual(["Omen", "Hex", "Pica", "Quill", "BOSS:Boss Raven"]);
    expect(underlingAt("hightable", 4)).toBeNull(); // Nyx/Grim not seated
  });
  it("single-table rooms: the one table IS the boss (no underlings)", () => {
    expect(underlingTableCount("dojo")).toBe(0);
    expect(underlingTableCount("suite")).toBe(0);
    expect(ROOM_RULES.dojo.boss).toBe("Sensei Owl");
    expect(ROOM_RULES.suite.boss).toBe("Boss Fox");
  });
});
