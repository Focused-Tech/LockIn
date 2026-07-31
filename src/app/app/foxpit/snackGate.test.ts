// @vitest-environment jsdom
/**
 * GATE §4 — Boss Snack Attack access is a COIN GATE. Drives the REAL mounted phone (SnackBarPhone)
 * for each case and asserts, from the rendered DOM, that the phone is LIT when the bar unlocks and
 * DARK when it's closed — plus the pure gate function agrees. One gate, one component.
 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SnackBarPhone } from "./SnackBarPhone";
import { snackBarUnlocked } from "@/lib/foxpit/snackGate";
import type { FoxPitRoomKey } from "@/lib/foxpit";

interface Case {
  name: string;
  coins: number;
  unlockedRooms: FoxPitRoomKey[];
  bossFoxBeaten: boolean;
  expectOpen: boolean;
}

const CASES: Case[] = [
  { name: "coins 0 → open", coins: 0, unlockedRooms: ["dojo"], bossFoxBeaten: false, expectOpen: true },
  { name: "coins 499 → open", coins: 499, unlockedRooms: ["dojo"], bossFoxBeaten: false, expectOpen: true },
  { name: "coins 500, only Dojo unlocked → CLOSED", coins: 500, unlockedRooms: ["dojo"], bossFoxBeaten: false, expectOpen: false },
  { name: "coins 1,500, Coliseum unlocked → CLOSED", coins: 1500, unlockedRooms: ["dojo", "coliseum"], bossFoxBeaten: false, expectOpen: false },
  { name: "coins 1,500, High Table unlocked (2,500 needed) → OPEN", coins: 1500, unlockedRooms: ["dojo", "coliseum", "hightable"], bossFoxBeaten: false, expectOpen: true },
  { name: "Boss Fox beaten → OPEN regardless", coins: 9999, unlockedRooms: ["dojo", "coliseum", "hightable", "suite"], bossFoxBeaten: true, expectOpen: true },
];

describe("GATE §4 — Snack Bar phone: coin gate, dark/lit", () => {
  const results: string[] = [];

  it.each(CASES)("$name", (c) => {
    // the one gate function agrees
    expect(snackBarUnlocked({ coins: c.coins, unlockedRooms: c.unlockedRooms, bossFoxBeaten: c.bossFoxBeaten })).toBe(c.expectOpen);

    // the REAL mounted phone renders the matching state
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);
    flushSync(() => root.render(h(SnackBarPhone as never, { coins: c.coins, unlockedRooms: c.unlockedRooms, bossFoxBeaten: c.bossFoxBeaten } as never)));

    const phone = el.querySelector("[data-snackphone]") as HTMLElement;
    expect(phone, "phone did not render").toBeTruthy();
    const lit = phone.getAttribute("data-lit") === "true";
    expect(lit, `${c.name}: phone lit=${lit}, expected ${c.expectOpen}`).toBe(c.expectOpen);

    results.push(`${c.expectOpen ? "OPEN " : "CLOSED"}  phone=${lit ? "LIT " : "DARK"}  — ${c.name}`);

    flushSync(() => root.unmount());
    el.remove();
  });

  it("prints the six results", () => {
    // eslint-disable-next-line no-console
    console.log("SNACK BAR COIN-GATE:\n" + results.map((r) => "  " + r).join("\n"));
    expect(results).toHaveLength(6);
  });
});
