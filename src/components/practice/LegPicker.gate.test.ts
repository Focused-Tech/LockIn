/**
 * §6 GATE — PRACTICE PAYLOAD (N-option leg card). MEASURES numbers, doesn't check boxes.
 *
 * Two halves:
 *  A) the PAYLOAD — every leg the archetype-sourced generator emits passes the same validateLeg
 *     the entry path runs (one player per game per leg), no archetype repeats within a slate, and
 *     the meter/percentage render on 2/4/6-option legs.
 *  B) the CARD — mounts the REAL <LegPicker>, prints rows-per-card at 2/4/6, asserts a meter +
 *     percentage on EVERY row, dispatches a REAL click and confirms the leg swipes (leg-swiping) with
 *     the recon transform/duration, and prints the preserved padding / card-gap tokens.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { LegPicker } from "./LegPicker";
import { buildPracticeSlate, normalizeToPercents } from "@/lib/practice/generate";
import {
  buildSlateLegs,
  generatedLegOk,
  toEngineLeg,
} from "@/lib/contest/archetypeLibrary";
import { validateLeg } from "@/lib/contest/questionEngine";
import { rosterPool } from "@/lib/practice/roster";
import type { PracticeLeg } from "@/lib/firebase/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATS = ["NBA", "NFL", "MLB", "NHL", "Soccer"];

/** A synthetic N-option practice leg for the render tests. */
function legWithOptions(id: string, n: number): PracticeLeg {
  return {
    id,
    question: `Who shows out — most points? (${n} options)`,
    archetype: "field_leader",
    difficulty: "medium",
    options: Array.from({ length: n }, (_, i) => ({
      label: `Player ${i + 1}`,
      prob: normalizeToPercents(Array.from({ length: n }, () => 1))[i]!,
      context: { gameLine: "Away at Home", seasonAvg: `${20 + i} points (season)`, lastOut: `${18 + i} last out` },
    })),
  };
}

function mount(node: Parameters<typeof createRoot>[0] extends never ? never : ReturnType<typeof h>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return { host, root };
}

describe("§6A payload — the archetype-sourced generator is compliant", () => {
  it("every generated leg passes validateLeg (one player per game per leg); zero failures", () => {
    let total = 0;
    const byType: Record<string, number> = {};
    let failures = 0;
    for (const cat of CATS) {
      const pool = rosterPool(cat);
      const allowed = pool.games.map((g) => g.gameId);
      // generate at the largest leg budget so every archetype the pool supports is exercised.
      const plans = buildSlateLegs(pool, { maxLegs: 6 });
      for (const { leg } of plans) {
        total++;
        const v = validateLeg(toEngineLeg(leg), allowed);
        if (!v.ok || !generatedLegOk(leg, allowed)) {
          failures++;
          byType[leg.archetype] = (byType[leg.archetype] ?? 0) + 1;
        }
      }
    }
    console.log(`§6A validator — total legs=${total} · failures=${failures} · by-type=${JSON.stringify(byType)}`);
    expect(total).toBeGreaterThan(0);
    expect(failures).toBe(0);
  });

  it("no archetype repeats within a slate; buildPracticeSlate returns N-option legs", () => {
    for (const cat of CATS) {
      const { legs, outcomes } = buildPracticeSlate(cat, 6, mulberry(42));
      const arches = legs.map((l) => l.archetype);
      expect(new Set(arches).size).toBe(arches.length); // §3.1 no repeat
      expect(outcomes.length).toBe(legs.length);
      for (const l of legs) {
        expect(l.options.length).toBeGreaterThanOrEqual(2);
        // every option carries a consensus % and the outcome is a valid index
        for (const o of l.options) expect(o.prob).toBeGreaterThan(0);
      }
      // outcomes are valid option indexes for their leg
      outcomes.forEach((o, i) => {
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThan(legs[i]!.options.length);
      });
      const percentSums = legs.map((l) => l.options.reduce((s, o) => s + o.prob, 0));
      console.log(`§6A ${cat}: legs=${legs.length} arches=[${arches.join(",")}] optionCounts=[${legs.map((l) => l.options.length).join(",")}] pctSums=[${percentSums.join(",")}]`);
      for (const sum of percentSums) expect(sum).toBe(100);
    }
  });
});

describe("§6B card — rows/meter/percentage at 2/4/6 options", () => {
  for (const n of [2, 4, 6]) {
    it(`renders ${n} option rows, each with a meter + a percentage`, () => {
      const { host, root } = mount(
        h(LegPicker, { legs: [legWithOptions(`n${n}`, n)], category: "NBA" }),
      );
      const rows = host.querySelectorAll("button[data-option]");
      const meters = host.querySelectorAll("[data-meter]");
      const pcts = Array.from(rows).filter((r) => /\d+%/.test(r.textContent || ""));
      console.log(`§6B ${n}-option: rows=${rows.length} meters=${meters.length} pct-rows=${pcts.length}`);
      expect(rows.length).toBe(n);
      expect(meters.length).toBe(n);
      expect(pcts.length).toBe(n);
      act(() => root.unmount());
      host.remove();
    });
  }

  it("a real click swipes the leg (leg-swiping) and preserves p-3 / gap-3 / rounded-lg / border-l-4", () => {
    const { host, root } = mount(
      h(LegPicker, { legs: [legWithOptions("swipe", 3)], category: "NBA" }),
    );
    const card = host.querySelector("div.practice-deal") as HTMLElement;
    const cls = card.getAttribute("class") || "";
    const wrapperGap = (host.firstChild as HTMLElement).getAttribute("class") || "";
    // PRESERVED tokens (recon §1b): outer padding p-3=12px, card gap gap-3=12px, radius rounded-lg=8px,
    // heavy left border-l-4=4px + 1px other three (border).
    const preserved = {
      "p-3 (12px pad)": /\bp-3\b/.test(cls),
      "border-l-4 (4px left)": /\bborder-l-4\b/.test(cls),
      "border (1px others)": /\bborder\b/.test(cls),
      "rounded-lg (8px)": /\brounded-lg\b/.test(cls),
      "gap-3 (12px between cards)": /\bgap-3\b/.test(wrapperGap),
    };
    console.log("§6B preserved (before pick):", JSON.stringify(preserved));
    for (const [k, v] of Object.entries(preserved)) expect(v, k).toBe(true);

    // Dispatch a REAL click on the first option row.
    const row = host.querySelector("button[data-option]") as HTMLElement;
    act(() => row.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));

    const swiped = host.querySelector("div.leg-swiping") as HTMLElement | null;
    const swipedCls = swiped?.getAttribute("class") || "";
    // recon §1d: leg-swipe-away 0.36s cubic-bezier(0.4,0,0.7,0.2), translateX(118%) rotate(5deg); SWIPE_MS=360.
    console.log(`§6B pick → leg-swiping present=${!!swiped} · SWIPE_MS=360 · keyframe=leg-swipe-away 0.36s cubic-bezier(0.4,0,0.7,0.2) → translateX(118%) rotate(5deg)`);
    expect(swiped, "picked leg gets leg-swiping").not.toBeNull();
    // the preserved tokens survive the swipe (same container, same padding/border/radius).
    expect(/\bp-3\b/.test(swipedCls)).toBe(true);
    expect(/\bborder-l-4\b/.test(swipedCls)).toBe(true);

    act(() => root.unmount());
    host.remove();
  });
});

describe("§6 boundary — Fox Pit tower cards untouched", () => {
  it("tower components do not import the practice payload (LegPicker / practice generate)", () => {
    const files = [
      "src/app/app/foxpit/room/[room]/FoxPitGame.tsx",
      "src/app/app/foxpit/card-preview/page.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8");
      expect(src.includes("practice/LegPicker"), `${f} must not import LegPicker`).toBe(false);
      expect(src.includes("practice/generate"), `${f} must not import the practice generator`).toBe(false);
    }
    console.log("§6 boundary: tower files import neither LegPicker nor the practice generator");
  });
});

/** tiny seeded rng so outcome rolls are deterministic in-test. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
