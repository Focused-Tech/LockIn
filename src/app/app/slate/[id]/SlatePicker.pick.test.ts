// @vitest-environment jsdom
/**
 * §1 GATE — the player-facing picker renders N-way archetype options through SlateCard: the correct
 * pick style per archetype, read-only context lines (never a text input), and a visible stats error.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

vi.mock("firebase/firestore", () => ({ doc: () => ({}), onSnapshot: () => () => {} }));
vi.mock("@/lib/firebase/client", () => ({ getDb: () => ({}) }));
vi.mock("./actions", () => ({ submitEntry: async () => ({ ok: true, entryId: "x" }) }));
vi.mock("@/components/cross-parlay/AddToParlay", () => ({ AddToParlay: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { SlatePicker, pickStyleFor, optionsFor } from "./SlatePicker";
import type { FeedPrediction, FeedSlate } from "@/lib/feed";

const pred = (o: Partial<FeedPrediction>): FeedPrediction => ({
  id: "x", question: "Q?", optionA: "", optionB: "", probA: 50, probB: 50, type: "binary", line: null, result: null, ...o,
});

const slate: FeedSlate = {
  id: "s1", title: "Tonight", category: "Sports", status: "live", creatorId: "c1",
  entryTiers: [{ tier: 5, hostingFeeCents: 100 }], entryCount: 40, isCardRush: false, rushMultiplier: 1, maxEntries: null,
  lockTimeMs: 4_000_000_000_000,
  predictions: [
    pred({ id: "h", question: "Bigger night?", type: "archetype", archetype: "cross_game_h2h", gameLine: "Dream @ Wings",
      options: [
        { key: "Luka", label: "Luka", seasonAverage: "28 pts · 8 reb", last3Form: "Last 3: 30, 25, 33" },
        { key: "Curry", label: "Curry", seasonAverage: "26 pts · 5 reb", last3Form: "Last 3: 20, 30, 28" },
      ] }),
    pred({ id: "m", question: "How many clear 30?", type: "archetype", archetype: "milestone_count",
      options: [{ key: "0-1", label: "0-1" }, { key: "2-3", label: "2-3" }, { key: "4", label: "4" }] }),
    pred({ id: "e", question: "Bigger night?", type: "archetype", archetype: "cross_game_h2h",
      options: [{ key: "X", label: "X" }, { key: "Y", label: "Y" }],
      contextError: "Stats unavailable for X — this leg can't be entered yet." }),
  ],
};

function mount() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  flushSync(() => createRoot(el).render(h(SlatePicker as never, {
    slate, coinBalance: 5000, cashBalanceCents: 10000, kycVerified: true, registeredState: "TX", existingEntry: null,
  } as never)));
  return el;
}

describe("§1 pick mapping", () => {
  it("maps each archetype to its pick style; binary → button; milestone → chips; else contest", () => {
    expect(pickStyleFor(pred({ type: "binary" }))).toBe("button");
    expect(pickStyleFor(pred({ type: "archetype", archetype: "milestone_count" }))).toBe("chips");
    expect(pickStyleFor(pred({ type: "archetype", archetype: "field_leader" }))).toBe("contest");
    // options carry context for players, none for buckets.
    const hOpts = optionsFor(slate.predictions[0]!);
    expect(hOpts.map((o) => o.key)).toEqual(["Luka", "Curry"]);
    expect(hOpts[0]!.secondary).toContain("28 pts · 8 reb");
  });
});

describe("§1 picker renders through SlateCard", () => {
  it("renders N archetype options, read-only context lines, and a visible stats error", () => {
    const el = mount();
    const text = el.textContent ?? "";
    // the head-to-head leg shows its two players + their context (read-only, never a text input).
    expect(text).toContain("Luka");
    expect(text).toContain("Curry");
    expect(text).toContain("28 pts · 8 reb"); // season avg context line
    expect(text).toContain("Dream @ Wings"); // the game line
    // the milestone leg shows its buckets.
    expect(text).toContain("0-1");
    expect(text).toContain("2-3");
    // context is read-only — no text inputs inside the legs.
    expect(el.querySelector("input")).toBeNull();
    // §1.2 — the stats-unavailable leg surfaces a visible error flag.
    const bad = el.querySelector('[data-flag="bad"]');
    expect(bad).toBeTruthy();
    expect(bad!.textContent).toContain("Stats unavailable");
  });
});
