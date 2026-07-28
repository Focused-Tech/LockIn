// @vitest-environment jsdom
/**
 * SLICE 3.4 GATE — render the uniform SlateCard in all five modes, cash and coins, with a passing
 * and a failing validation result. Assert on RENDERED OUTPUT (not code). Capture 'error' AND
 * 'unhandledrejection'. Dispatch a real click.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SlateCard, type SlateLeg, type SlateCardProps } from "./SlateCard";

const errors: unknown[] = [];
window.addEventListener("error", (e) => errors.push((e as ErrorEvent).error ?? (e as ErrorEvent).message));
window.addEventListener("unhandledrejection", (e) => errors.push((e as PromiseRejectionEvent).reason));

const okLeg = (): SlateLeg => ({
  question: "Who has the bigger night?",
  state: "ok",
  picks: [
    { label: "Luka", secondary: "Lakers", selected: true },
    { label: "Curry", secondary: "Warriors" },
  ],
  context: { seasonAverage: "28.1", last3Form: "31 / 29 / 33", matchupNote: "vs Celtics" },
  flag: { variant: "ok", message: "2 players, 2 different games. Clean." },
});
const badLeg = (): SlateLeg => ({
  ...okLeg(),
  state: "bad",
  flag: { variant: "bad", message: "<b>Luka</b> and <b>Tatum</b> are both in Lakers at Celtics — drop one." },
});

function renderCard(props: SlateCardProps) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  flushSync(() => root.render(h(SlateCard, props)));
  return el;
}

describe("uniform SlateCard (slice 3.4)", () => {
  beforeEach(() => {
    errors.length = 0;
  });

  const MODES = ["foxpit", "beginner", "advanced", "practice", "creator"];
  const CURRENCIES = ["cash", "coins"] as const;

  for (const mode of MODES) {
    for (const currency of CURRENCIES) {
      it(`renders ${mode} / ${currency} (passing validation)`, () => {
        const el = renderCard({ mode, currency, legs: [okLeg()], stakeOptions: [5, 10, 15], answered: true, selectedStake: 5 });
        expect(errors).toEqual([]);
        // exactly one leg, ok border state
        expect(el.querySelectorAll("[data-leg-state]").length).toBe(1);
        expect(el.querySelector("[data-leg-state]")!.getAttribute("data-leg-state")).toBe("ok");
        // two pick chips
        expect(el.querySelectorAll("[data-pick]").length).toBe(2);
        // required display-only context strip present
        expect(el.querySelector("[data-context]")).toBeTruthy();
        // per-card stake footer, three chips, currency-correct label
        expect(el.querySelectorAll("[data-stake]").length).toBe(3);
        expect(el.querySelector("[data-stake-footer]")!.textContent).toContain(currency === "cash" ? "$5" : "5 ⛃");
        // currency is a prop on the card root
        expect(el.querySelector("[data-currency]")!.getAttribute("data-currency")).toBe(currency);
        expect(el.querySelector("[data-mode]")!.getAttribute("data-mode")).toBe(mode);
      });
    }
  }

  it("failing validation → bad leg state + bad flag + stake footer locked until answered", () => {
    const el = renderCard({ mode: "creator", currency: "cash", legs: [badLeg()], stakeOptions: [5], answered: false });
    expect(errors).toEqual([]);
    expect(el.querySelector("[data-leg-state]")!.getAttribute("data-leg-state")).toBe("bad");
    expect(el.querySelector("[data-flag='bad']")).toBeTruthy();
    expect(el.querySelector("[data-flag='bad']")!.textContent).toContain("drop one");
    expect((el.querySelector("[data-stake]") as HTMLButtonElement).disabled).toBe(true);
  });

  it("dispatches a real click on a pick chip", () => {
    const onPick = vi.fn();
    const el = renderCard({ mode: "advanced", currency: "coins", legs: [okLeg()], stakeOptions: [5], answered: true, onPick });
    const pick = el.querySelector("[data-pick]") as HTMLButtonElement;
    flushSync(() => pick.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onPick).toHaveBeenCalledWith(0, 0);
    expect(errors).toEqual([]);
  });
});
