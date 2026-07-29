// @vitest-environment jsdom
/** §1 GATE — opening a dealt card yields an OPAQUE overlay whose body scrolls, with options rendered
 *  READ-ONLY (static rows, not pick buttons). Drives the real DealPhase with a dispatched click. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
vi.mock("../../actions", () => ({ applyFoxPitCoins: async () => ({}), dealFoxRound: async () => ({ ok: true, slates: [] }) }));
import { DealPhase } from "./FoxPitGame";
import type { FoxSlate } from "@/lib/foxpit/slates";

const slate = (id: string): FoxSlate => ({
  id, category: "music", title: `Card ${id}`, realData: false, playCount: 1, stake: null,
  questions: [
    { id: `${id}q1`, text: "First question?", options: ["A", "B", "C", "D"], correctIndex: 0 },
    { id: `${id}q2`, text: "Second question that runs long?", options: ["W", "X", "Y", "Z"], correctIndex: 1 },
  ],
});

function mount() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const props = { slates: [slate("a")], kept: new Set<string>(), redealsLeft: 1, accent: "#c22b22", onToggle: vi.fn(), onRedeal: vi.fn(), onPlay: vi.fn(), onAutoPlay: vi.fn() };
  flushSync(() => createRoot(el).render(h(DealPhase as never, props as never)));
  return el;
}

describe("§1 opened DEAL card", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("opens opaque, scrolls, and renders options read-only (not pick buttons)", () => {
    const el = mount();
    // drive the REAL mini: tap it to open the full card
    const mini = el.querySelector('button[aria-label^="Read"]') as HTMLButtonElement;
    expect(mini).toBeTruthy();
    flushSync(() => mini.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const overlay = document.querySelector("[data-opened-overlay]") as HTMLElement;
    expect(overlay).toBeTruthy();
    // §1.2 fully opaque — solid bg-background, never the /95 translucent that bled the bottom bar
    expect(overlay.className).toContain("bg-background");
    expect(overlay.className).not.toContain("bg-background/95");
    // §1.1 a scroll container is present (overflow-y-auto) so a tall card reaches its end
    expect(overlay.querySelector(".overflow-y-auto")).toBeTruthy();
    // §1.3 options are READ-ONLY rows — data-pick marked data-readonly, and NO <button> pick in the overlay
    const roPicks = overlay.querySelectorAll('[data-pick][data-readonly="true"]');
    expect(roPicks.length).toBe(8); // 2 questions × 4 options
    expect(overlay.querySelector("button[data-pick]")).toBeNull();
    // both questions are in the DOM (reachable by scrolling)
    expect(overlay.textContent).toContain("First question?");
    expect(overlay.textContent).toContain("Second question that runs long?");
  });
});
