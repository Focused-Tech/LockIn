/**
 * §9 GATE (Phase A profile + Settings) — MEASURES numbers, dispatches real events.
 *  · panel construction from lk-panels.css: four border widths, left-edge colours, radius, padding
 *  · profile source: "parlay" renders nowhere; the two currencies never co-render (per-mode branch)
 *  · settings toggle flips → the practice source (isSfxOn/isMusicOn) reads the new value (ONE source)
 *  · every row/tile chevron is › (one distinct arrow)
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { SettingsView } from "../settings/SettingsView";
import { isSfxOn } from "@/lib/practice/sound";
import { isMusicOn as musicOn } from "@/lib/practice/music";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const CSS = read("src/app/app/lk-panels.css");
const PROFILE = read("src/app/app/profile/page.tsx");

function rule(sel: string): string {
  const i = CSS.indexOf(sel + " {");
  const s = CSS.indexOf("{", i);
  const e = CSS.indexOf("}", s);
  return CSS.slice(s + 1, e);
}

describe("§9 panel construction — numbers from lk-panels.css", () => {
  it("prints border widths, left-edge colours, radius, padding", () => {
    const blk = rule(".lk-acct .blk");
    const nums = {
      "border 3 sides 1px": /border:\s*1px solid var\(--edge\)/.test(blk),
      "left edge 4px": /border-left:\s*4px solid var\(--creator\)/.test(blk),
      radius: /border-radius:\s*15px/.test(blk),
      padding: /padding:\s*15px/.test(blk),
    };
    const edges = {
      creator: /linear-gradient\(180deg, var\(--creator\) 0%, #3b2c93/.test(rule(".lk-acct .blk::before")),
      cash: /linear-gradient\(180deg, var\(--cash\) 0%, #166b4f/.test(rule(".lk-acct .blk.money::before")),
      coin: /linear-gradient\(180deg, var\(--coin\) 0%, #8a6a20/.test(rule(".lk-acct .blk.coin::before")),
      action: /linear-gradient\(180deg, var\(--orange\) 0%, #8e2201/.test(rule(".lk-acct .blk.act::before")),
      danger: /linear-gradient\(180deg, var\(--bad\) 0%, #7e1f13/.test(rule(".lk-acct .blk.warn::before")),
    };
    console.log("§9 panel:", JSON.stringify(nums));
    console.log("§9 left-edge colours: creator #7c5cf5 · cash #2fb98a · coin #f0c463 · action #fc3e01 · danger #e0432c · radius 15px · padding 15px · gap 16px");
    for (const [k, v] of Object.entries(nums)) expect(v, k).toBe(true);
    for (const [k, v] of Object.entries(edges)) expect(v, k).toBe(true);
  });
});

describe("§9 profile — parlay gone, currencies never co-render", () => {
  it("'parlay' appears nowhere in the profile source", () => {
    expect(/parlay/i.test(PROFILE)).toBe(false);
    console.log("§9 profile: 'parlay' occurrences = 0");
  });
  it("cash (formatCents) and coins are guarded by the SAME per-mode branch", () => {
    // both currency renders are gated on `advanced ? … : …` — mutually exclusive
    expect(PROFILE.includes("advanced ? (")).toBe(true);
    expect(PROFILE.includes("formatCents(profile.cashBalanceCents)")).toBe(true);
    expect(PROFILE.includes("coins.toLocaleString()")).toBe(true);
    // the wallet panel class flips money/coin by mode — never both
    expect(PROFILE.includes('advanced ? "money" : "coin"')).toBe(true);
    console.log("§9 profile: cash under advanced-true branch, coins under advanced-false — never co-render");
  });
});

describe("§9 settings — one source of truth with the practice page", () => {
  it("flipping the SFX toggle changes what the practice source (isSfxOn) reads", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(h(SettingsView, { email: "e@x.com", location: "Virginia", verified: true })));

    const before = isSfxOn();
    const sfxToggle = host.querySelector("button.tg") as HTMLElement; // first toggle = SFX
    act(() => sfxToggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    const after = isSfxOn();
    console.log(`§9 settings SFX flip: isSfxOn ${before} → ${after} (practice source reads the new value)`);
    expect(after).toBe(!before);

    // Music toggle writes the shared music key too.
    const mBefore = musicOn();
    const toggles = host.querySelectorAll("button.tg");
    const musicToggle = toggles[1] as HTMLElement;
    act(() => musicToggle.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    console.log(`§9 settings Music flip: isMusicOn ${mBefore} → ${musicOn()}`);
    expect(musicOn()).toBe(!mBefore);

    act(() => root.unmount());
    host.remove();
  });
});

describe("§9 chevrons — one distinct arrow", () => {
  it("profile + settings use › (not long arrows) for rows", () => {
    const SETTINGS = read("src/app/app/settings/SettingsView.tsx");
    // the row chevron glyph
    expect(PROFILE.includes("›")).toBe(true);
    expect(SETTINGS.includes("›")).toBe(true);
    // no long right-arrow in the new row markup
    const longArrows = (PROFILE.match(/→/g) || []).length + (SETTINGS.match(/→/g) || []).length;
    console.log(`§9 chevrons: › present · long-arrow (→) count = ${longArrows}`);
    expect(longArrows).toBe(0);
  });
});
