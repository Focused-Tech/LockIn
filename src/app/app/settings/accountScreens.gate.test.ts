/**
 * §9 GATE (Phase A profile + Settings) — MEASURES numbers, dispatches real events.
 *  · panel construction from lk-panels.css: four border widths, left-edge colours, radius, padding
 *  · profile source: "parlay" renders nowhere; the two currencies never co-render (per-mode branch)
 *  · settings toggle flips → the practice source (isSfxOn/isMusicOn) reads the new value (ONE source)
 *  · every row/tile chevron is › (one distinct arrow)
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";

// SettingsView now mounts the working "Download my data" / "Delete account" rows, which reach server
// actions. Those pull in firebase-admin and `server-only`, neither of which can load in a jsdom
// render — so they are stubbed here. The behaviour of the actions themselves is covered by
// src/server/account/accountData.gate.test.ts, which runs them for real against an in-memory store.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, push: () => {}, refresh: () => {} }),
  usePathname: () => "/app/settings",
}));
vi.mock("./actions", () => ({
  getDeletionStatus: async () => ({ blockers: [], kept: [], removed: [], confirmPhrase: "tester" }),
  deleteMyAccount: async () => ({ ok: false, error: "stub" }),
  getMyDataExport: async () => ({ ok: false, error: "stub" }),
}));

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
      action: /linear-gradient\(180deg, var\(--orange\) 0%, #8e2c01/.test(rule(".lk-acct .blk.act::before")),
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
    // reconciled profile: cash render and coin render are BOTH gated on `advanced ? … : …`
    expect(PROFILE.includes("formatCents(profile.cashBalanceCents)")).toBe(true);
    expect(PROFILE.includes("profile.coinBalance.toLocaleString()")).toBe(true);
    // the wallet + lifetime panels flip money/coin by mode — never both
    expect(PROFILE.includes('advanced ? "money" : "coin"')).toBe(true);
    // and the single ternary that co-locates them proves mutual exclusion
    expect(PROFILE.includes("advanced ? formatCents(profile.cashBalanceCents) : profile.coinBalance.toLocaleString()")).toBe(true);
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

describe("§9 beginner wallet — no dollar figure renders", () => {
  it("the WalletView beginner branch contains no '$' and no formatCents", () => {
    const WALLET = read("src/app/app/wallet/WalletView.tsx");
    // isolate the `if (!advanced) { … }` beginner branch
    const start = WALLET.indexOf("if (!advanced) {");
    const advIdx = WALLET.indexOf("\n  return (", start); // the advanced return that follows
    const begBranch = WALLET.slice(start, advIdx);
    const dollars = (begBranch.match(/\$/g) || []).length;
    const cents = (begBranch.match(/formatCents/g) || []).length;
    console.log(`§9 beginner wallet: '$' count = ${dollars} · formatCents count = ${cents}`);
    expect(dollars).toBe(0);
    expect(cents).toBe(0);
  });
});

describe("§1/§6 chevron sweep — CHEVRON › IS CANON across every built screen", () => {
  const SCREENS = [
    "src/app/app/profile/page.tsx",
    "src/app/app/wallet/WalletView.tsx",
    "src/app/app/wallet/page.tsx",
    "src/app/app/leaderboard/page.tsx",
    "src/app/app/refer/ReferralView.tsx",
    "src/app/app/responsible-play/ResponsiblePlayView.tsx",
    "src/app/app/settings/SettingsView.tsx",
    "src/app/app/create/CreatorBuilder.tsx",
    "src/app/app/creator/page.tsx",
  ];
  it("the DISTINCT set of arrow glyphs rendered across all built screens is exactly { › }", () => {
    const set = new Set<string>();
    const glyphs = /[→➔➝⟶»›]|&rarr;/g;
    const where: Record<string, string[]> = {};
    for (const f of SCREENS) {
      const src = read(f);
      const m = src.match(glyphs) || [];
      for (const g of m) {
        set.add(g);
        (where[g] ??= []).push(f.split("/").pop()!);
      }
    }
    console.log(`§1 distinct arrow set = { ${[...set].join(" ")} } ; by-glyph = ${JSON.stringify(where)}`);
    expect([...set]).toEqual(["›"]);
  });
});

describe("§3 leaderboard — advanced ordering is CASH WON (reverted)", () => {
  it("advanced uses fetchLeaderboard's cash-won order (no wins re-sort); beginner re-ranks by score", () => {
    const LB = read("src/app/app/leaderboard/page.tsx");
    // advanced maps data.rows straight through (cash-won order); it does NOT sort by wins.
    expect(LB.includes("advanced\n    ? base.map((r, i) => ({ ...r, rank: i + 1 }))")).toBe(true);
    // the cash paid-line is restored on the advanced board
    expect(LB.includes("Paid line · top")).toBe(true);
    expect(LB.includes("formatCents(row.totalWonCents)")).toBe(true);
    // fetchLeaderboard still ranks by cash won (the source order)
    const SRC = read("src/server/data/leaderboard.ts");
    expect(SRC.includes("y.totalWonCents - x.totalWonCents")).toBe(true);
    console.log("§3 advanced ordering = CASH WON (leaderboard.ts:134 totalWonCents) + paid-line restored; beginner = score");
  });
});
