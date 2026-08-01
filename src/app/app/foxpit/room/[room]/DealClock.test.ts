// @vitest-environment jsdom
/** 3.3 / §2.4 GATE — the deal decision window base is raised to 60 and renders on the real DealPhase.
 *  (The pause-while-open is the `if (opened) return` guard in the clock effect, verified on device.) */
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
vi.mock("../../actions", () => ({ applyFoxPitCoins: async () => ({}), dealFoxRound: async () => ({ ok: true, slates: [] }) }));
import { DealPhase } from "./FoxPitGame";
import { TIMERS } from "@/lib/foxpit/rules";
import type { FoxSlate } from "@/lib/foxpit/slates";

const slate = (id: string): FoxSlate => ({
  id, category: "music", title: `S${id}`, realData: false, playCount: 1, stake: null,
  questions: [{ id: `${id}q`, text: "Q?", options: ["a", "b"], correctIndex: 0 }],
});

describe("3.3 deal clock", () => {
  it("base decision window is 60 and renders at mount", () => {
    expect(TIMERS.discardDecision).toBe(60);
    const el = document.createElement("div");
    document.body.appendChild(el);
    const props = { slates: [slate("a")], kept: new Set<string>(), redealsLeft: 1, accent: "#c22b22", onToggle: vi.fn(), onRedeal: vi.fn(), onPlay: vi.fn(), onAutoPlay: vi.fn() };
    flushSync(() => createRoot(el).render(h(DealPhase as never, props as never)));
    expect(el.textContent).toContain("60s");
  });
});
