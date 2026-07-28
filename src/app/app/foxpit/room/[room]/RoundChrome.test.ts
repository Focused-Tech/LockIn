// @vitest-environment jsdom
/**
 * 3.3b GATE — the keydrop lives in the chrome row (never floating over a card), the title splits so
 * it doesn't truncate, and the quit label is short. Asserts on rendered output.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { RoundChrome } from "./RoundChrome";

const errors: unknown[] = [];
window.addEventListener("error", (e) => errors.push((e as ErrorEvent).error ?? (e as ErrorEvent).message));
window.addEventListener("unhandledrejection", (e) => errors.push((e as PromiseRejectionEvent).reason));

function render(props: Record<string, unknown>) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  flushSync(() => createRoot(el).render(h(RoundChrome as never, props as never)));
  return el;
}
const base = {
  oppName: "Sensei Owl", roundIndex: 0, rounds: 2, keepN: 1, slatesPerRound: 5, accent: "#c9873f",
  clockVisible: true, clockLabel: "1:30", clockAlert: false, roundsWon: 0, onQuit: () => {},
};

describe("RoundChrome (3.3b)", () => {
  beforeEach(() => { errors.length = 0; });

  it("keydrop lives INSIDE the chrome, beside the timer — not floating over a card", () => {
    const el = render({ ...base, onKeydrop: () => {} });
    expect(errors).toEqual([]);
    const chrome = el.querySelector("[data-round-chrome]")!;
    const keydrop = el.querySelector("[data-keydrop]")!;
    expect(keydrop).toBeTruthy();
    expect(chrome.contains(keydrop)).toBe(true); // structural: keydrop is a child of the chrome
    // it is NOT a `fixed`-positioned floating pill anymore
    expect((keydrop as HTMLElement).className).not.toContain("fixed");
    // clock is in the same chrome
    expect(chrome.contains(el.querySelector("[data-clock]")!)).toBe(true);
  });

  it("title splits — opponent on line 1, round/keep on line 2 (no single truncating string)", () => {
    const el = render({ ...base });
    // line 1 is just the opponent name — not "SENSEI OWL · ROUND 1/2" jammed onto one line
    expect(el.querySelector("[data-chrome-title]")!.textContent).toBe("SENSEI OWL");
    expect(el.querySelector("[data-round-chrome]")!.textContent).toContain("ROUND 1/2");
    expect(el.querySelector("[data-round-chrome]")!.textContent).toContain("KEEP 1/5");
  });

  it("quit label is short ('‹ Quit'), and keydrop is removable (omit onKeydrop)", () => {
    const el = render({ ...base }); // no onKeydrop
    expect(el.querySelector("[data-quit]")!.textContent!.trim()).toBe("‹ Quit");
    expect(el.querySelector("[data-keydrop]")).toBeNull();
  });
});
