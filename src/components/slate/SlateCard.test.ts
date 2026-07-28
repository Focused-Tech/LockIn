// @vitest-environment jsdom
/**
 * SLICE 3.4 GATE — render the uniform SlateCard across five modes, cash + coins, passing + failing
 * validation, plus the Fox Pit face-image variant and the lock overlay. Assert on RENDERED OUTPUT.
 * Capture 'error' AND 'unhandledrejection'. Dispatch real clicks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SlateCard, type SlateLeg, type SlateCardProps } from "./SlateCard";

const errors: unknown[] = [];
window.addEventListener("error", (e) => errors.push((e as ErrorEvent).error ?? (e as ErrorEvent).message));
window.addEventListener("unhandledrejection", (e) => errors.push((e as PromiseRejectionEvent).reason));

const CAT = "#54B9FF"; // a category-canon color
const CAT_RGB = "rgb(84, 185, 255)"; // jsdom normalizes the hex border to rgb()
const okLeg = (): SlateLeg => ({
  question: "Who has the bigger night?",
  state: "ok",
  picks: [
    { label: "Luka", secondary: ["Lakers at Celtics", "32 a night"], selected: true },
    { label: "Jokić", secondary: ["Denver vs Phoenix", "26 · 12 · 9"] },
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
  flushSync(() => createRoot(el).render(h(SlateCard, props)));
  return el;
}
const base = (over: Partial<SlateCardProps>): SlateCardProps => ({
  mode: "advanced", currency: "cash", catColor: CAT, legs: [okLeg()],
  title: "Tuesday Night Five", eyebrow: "QUILL · HAWK",
  stakeMode: "always", stakeOptions: [5, 10, 15], selectedStake: 10, ...over,
});

describe("uniform SlateCard (slice 3.4)", () => {
  beforeEach(() => { errors.length = 0; });

  const MODES = ["foxpit", "beginner", "advanced", "practice", "creator"];
  for (const mode of MODES) {
    for (const currency of ["cash", "coins"] as const) {
      it(`renders ${mode} / ${currency} (passing)`, () => {
        const el = renderCard(base({ mode, currency }));
        expect(errors).toEqual([]);
        // category BEZEL — the card border uses the category color
        expect((el.firstElementChild as HTMLElement).style.border).toContain(CAT_RGB);
        // one ok leg
        expect(el.querySelectorAll("[data-leg-state]").length).toBe(1);
        expect(el.querySelector("[data-leg-state]")!.getAttribute("data-leg-state")).toBe("ok");
        // picks + required context
        expect(el.querySelectorAll("[data-pick]").length).toBe(2);
        expect(el.querySelector("[data-context]")).toBeTruthy();
        // TITLE is sans-serif semibold (not a serif face)
        const titleCls = el.querySelector("[data-title]")!.className;
        expect(titleCls).toContain("font-semibold");
        expect(titleCls).not.toContain("font-serif");
        // stake footer, currency-correct
        expect(el.querySelectorAll("[data-stake]").length).toBe(3);
        expect(el.querySelector("[data-stake-footer]")!.textContent).toContain(currency === "cash" ? "$5" : "5 ⛃");
        // keydrop is NEVER on the card
        expect(el.querySelector("[data-keydrop]")).toBeNull();
        expect(el.textContent).not.toContain("keydrop");
        expect(el.querySelector("[data-currency]")!.getAttribute("data-currency")).toBe(currency);
      });
    }
  }

  it("Fox Pit face variant renders the baked image, not the code title", () => {
    const el = renderCard(base({ mode: "foxpit", faceImage: "/foxpit/cards/card_front_single.png" }));
    expect(errors).toEqual([]);
    const img = el.querySelector("[data-face-image]") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("/foxpit/cards/card_front_single.png");
    expect(el.querySelector("[data-title]")).toBeNull(); // wordmark is baked, code title suppressed
    expect((el.firstElementChild as HTMLElement).style.border).toContain(CAT_RGB); // bezel still applies
  });

  it("failing validation → bad leg + bad flag; afterAnswers stake gated until answered", () => {
    const el = renderCard(base({ legs: [badLeg()], stakeMode: "afterAnswers", answered: false }));
    expect(errors).toEqual([]);
    expect(el.querySelector("[data-leg-state]")!.getAttribute("data-leg-state")).toBe("bad");
    expect(el.querySelector("[data-flag='bad']")!.textContent).toContain("drop one");
    expect(el.querySelector("[data-stake-hint]")).toBeTruthy(); // gated: hint shown, no chips
    expect(el.querySelector("[data-stake-footer]")).toBeNull();
  });

  it("disabled CTA + lock overlay render", () => {
    const el = renderCard(base({ cta: { label: "Lock in", disabled: true }, locking: true }));
    expect((el.querySelector("[data-cta]") as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector("[data-lockfx]")).toBeTruthy();
    expect(errors).toEqual([]);
  });

  it("dispatches real clicks on a pick and the CTA", () => {
    const onPick = vi.fn(), onCta = vi.fn();
    const el = renderCard(base({ cta: { label: "Play" }, onPick, onCta }));
    flushSync(() => (el.querySelector("[data-pick]") as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    flushSync(() => (el.querySelector("[data-cta]") as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onPick).toHaveBeenCalledWith(0, 0);
    expect(onCta).toHaveBeenCalled();
    expect(errors).toEqual([]);
  });
});
