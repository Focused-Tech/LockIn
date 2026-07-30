// @vitest-environment jsdom
/**
 * §1 GATE — the mounted builder: the roster pool fills from the SELECTED games only, a feed error
 * surfaces visibly (no seed fallback), and picking players fetches the feed CONTEXT (season avg +
 * last-out). Drives the real component with dispatched events.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

const { fetchLegContext } = vi.hoisted(() => ({
  fetchLegContext: vi.fn(async () => [{ playerId: "p_luka", name: "Luka", seasonAverage: "28 pts · 8 reb · 8 ast", last3Form: "Last 3: 30, 25, 33 pts" }]),
}));
vi.mock("./actions", () => ({ publishProSlate: async () => ({ ok: true, slateId: "x" }), fetchLegContext }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CreatorMode } from "./CreatorMode";
import { FIXTURE_GAMES } from "@/lib/contest/gameFixtures";

const baseProps = {
  games: FIXTURE_GAMES,
  feedError: null as string | null,
  formatTier: "standard" as const,
  cashReach: 44,
  totalStates: 50,
  canHostCash: true,
  cashBlockReason: null as string | null,
};

function mount(props: Record<string, unknown>) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  flushSync(() => createRoot(el).render(h(CreatorMode as never, props as never)));
  return el;
}

describe("§1 creator builder", () => {
  beforeEach(() => { document.body.innerHTML = ""; fetchLegContext.mockClear(); });

  it("roster pool fills from the SELECTED games only (gA + gB = 8 players, no others)", () => {
    const el = mount(baseProps);
    // default selects the first two fixture games (gA, gB).
    const chipNames = [...el.querySelectorAll("button")].map((b) => b.textContent ?? "").filter((t) => /Luka|LeBron|Tatum|Brown|Embiid|Maxey|Curry|Green/.test(t));
    const names = new Set(chipNames.map((t) => t.trim().split(" ")[0]));
    expect(names).toEqual(new Set(["Luka", "LeBron", "Tatum", "Brown", "Embiid", "Maxey", "Curry", "Green"]));
  });

  it("shows a visible feed error and NO builder when the feed failed (§1.C — no seed fallback)", () => {
    const el = mount({ ...baseProps, games: [], feedError: "Couldn't load tonight's games." });
    expect(el.querySelector("[data-feed-error]")).toBeTruthy();
    expect(el.textContent).toContain("Couldn't load tonight's games.");
    // the games/questions cards are not rendered.
    expect(el.textContent).not.toContain("Tonight's games");
  });

  it("picking a player fetches the feed CONTEXT for the leg (season avg + last-out), not typed", () => {
    const el = mount(baseProps);
    // the context slot starts as a prompt (feed-sourced, never a text input).
    expect(el.querySelector("[data-leg-context]")).toBeTruthy();
    expect(el.querySelector('input[placeholder="Season avg"]')).toBeNull();
    // dispatch a click on the "Luka" player chip → fires the batched context fetch.
    const luka = [...el.querySelectorAll("button")].find((b) => /^Luka/.test((b.textContent ?? "").trim()));
    expect(luka).toBeTruthy();
    flushSync(() => luka!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(fetchLegContext).toHaveBeenCalledWith(["p_luka"]);
  });
});
