// @vitest-environment jsdom
/**
 * A GATE — heal the DEAL divergence without losing the feature. Drives the REAL DealPhase with
 * dispatched events: minis carry no question, tap opens the SAME card full screen with the question,
 * hardware/gesture back dismisses the overlay back to the grid, keep is reachable from BOTH the mini
 * and the opened card, and "To the table" (onPlay → PlayPhase) is reachable once the overlay is closed.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
vi.mock("../../actions", () => ({ applyFoxPitCoins: async () => ({}), dealFoxRound: async () => ({ ok: true, slates: [] }) }));
import { DealPhase } from "./FoxPitGame";
import type { FoxSlate } from "@/lib/foxpit/slates";

const slate = (id: string): FoxSlate => ({
  id, category: "music", title: `Slate ${id}`, realData: false, playCount: 2, stake: null,
  questions: [
    { id: `${id}q1`, text: "Which city hosted the 2020 halftime show?", options: ["Tampa", "Miami", "Houston", "Atlanta"], correctIndex: 1 },
    { id: `${id}q2`, text: "Second question here?", options: ["A", "B"], correctIndex: 0 },
  ],
});
const base = () => ({
  slates: [slate("a"), slate("b")], kept: new Set<string>(), redealsLeft: 1, accent: "#c22b22",
  onToggle: vi.fn(), onRedeal: vi.fn(), onPlay: vi.fn(), onAutoPlay: vi.fn(),
});
function render(props: unknown) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  flushSync(() => createRoot(el).render(h(DealPhase as never, props as never)));
  return el;
}

describe("DealPhase heal (A)", () => {
  it("mini = no question; tap opens the SAME card full screen WITH the question", () => {
    const el = render(base());
    expect(el.querySelectorAll('button[aria-label^="Read "]').length).toBe(2);
    expect(el.textContent).not.toContain("Which city hosted"); // KEEP: mini carries no question text
    flushSync(() => (el.querySelector('button[aria-label^="Read "]') as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(el.querySelector("[data-opened-overlay]")).toBeTruthy();
    expect(el.textContent).toContain("Which city hosted"); // opened carries the question
  });

  it("hardware/gesture back dismisses the overlay back to the deal grid (the trap is gone)", () => {
    const el = render(base());
    flushSync(() => (el.querySelector('button[aria-label^="Read "]') as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(el.querySelector("[data-opened-overlay]")).toBeTruthy();
    flushSync(() => window.dispatchEvent(new PopStateEvent("popstate"))); // hardware back
    expect(el.querySelector("[data-opened-overlay]")).toBeNull(); // dismissed
    expect(el.querySelectorAll('button[aria-label^="Read "]').length).toBe(2); // grid intact
  });

  it("keep from BOTH the mini and the opened card; to-the-table reaches onPlay when closed", () => {
    const props = base();
    const el = render(props);
    // keep from the mini chip
    const keepChip = [...el.querySelectorAll("button")].find((b) => /^keep$/i.test((b.textContent || "").trim()));
    expect(keepChip).toBeTruthy();
    flushSync(() => keepChip!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(props.onToggle).toHaveBeenCalled();
    // keep from the opened card
    flushSync(() => (el.querySelector('button[aria-label^="Read "]') as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const keepBtn = [...el.querySelectorAll("button")].find((b) => /keep this card|throw back/i.test(b.textContent || ""));
    expect(keepBtn).toBeTruthy();
    flushSync(() => keepBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    // close (hardware back), then "To the table" is reachable and fires onPlay
    flushSync(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(el.querySelector("[data-opened-overlay]")).toBeNull();
    const toTable = [...el.querySelectorAll("button")].find((b) => /to the table/i.test(b.textContent || ""));
    expect(toTable).toBeTruthy();
    flushSync(() => toTable!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(props.onPlay).toHaveBeenCalled(); // reaches PlayPhase (startPlay is byte-identical to 54e84da)
  });
});
