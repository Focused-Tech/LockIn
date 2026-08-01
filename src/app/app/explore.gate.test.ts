// @vitest-environment jsdom
/**
 * GATE — EXPLORE REDESIGN (§6). Renders ExploreFeed and asserts the structure, with printed results.
 *   §6.2 every feed card is the uniform SlateCard (compact) instance — not a bespoke card.
 *   §6.3 no rake string renders anywhere on Explore.
 *   §6.4 the feed column carries bottom-nav/FAB clearance.
 *   §6.5 exactly one visible filter row (category chips); currency + stake are behind one control.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement as h, act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The feed subscribes via Firestore onSnapshot — stub it so the SSR payload stays in place.
vi.mock("firebase/firestore", () => ({ collection: () => ({}), onSnapshot: () => () => {} }));
vi.mock("@/lib/firebase/client", () => ({ getDb: () => ({}) }));

import { ExploreFeed } from "./ExploreFeed";
import type { FeedSlate } from "@/lib/feed";
import type { RecSignals } from "@/lib/recommendations";

const log = (m: string) => console.log(m); // eslint-disable-line no-console
let mounted: { el: HTMLElement; root: Root } | null = null;
afterEach(() => { if (mounted) { act(() => mounted!.root.unmount()); mounted.el.remove(); mounted = null; } });

const slate = (over: Partial<FeedSlate> & { id: string }): FeedSlate => ({
  title: "Tonight's slate",
  category: "NBA",
  status: "live",
  creatorId: "c1",
  entryTiers: [{ tier: 5, hostingFeeCents: 100 }, { tier: 10, hostingFeeCents: 200 }, { tier: 25, hostingFeeCents: 300 }],
  entryCount: 1200,
  isCardRush: false,
  rushMultiplier: 1,
  maxEntries: null,
  lockTimeMs: Date.now() + 3_600_000,
  predictions: [],
  creatorName: "hoops_guru",
  creatorTrackRecord: "68% hit rate",
  ...over,
});

const SIGNALS: RecSignals = { categoryWinRates: {}, categoryPlays: {}, followedCreators: [], tierCounts: {} };

function mount(node: React.ReactElement): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  mounted = { el, root };
  return el;
}

describe("§6 GATE — Explore redesign", () => {
  it("6.2/6.3/6.4/6.5 — uniform cards, no rake, clearance, one filter row", () => {
    const slates = [
      slate({ id: "s1", category: "NBA", entryCount: 1200 }),
      slate({ id: "s2", category: "Soccer", entryCount: 40, isCardRush: true, rushMultiplier: 2 }),
      slate({ id: "s3", category: "NFL", status: "locked", entryCount: 300 }),
    ];
    const el = mount(h(ExploreFeed, { initialSlates: slates, signals: SIGNALS }));

    // §6.2 — every feed card is the uniform SlateCard compact instance (data-mode="feed" + data-compact).
    const cards = [...el.querySelectorAll("[data-compact]")] as HTMLElement[];
    const allFeed = cards.every((c) => c.getAttribute("data-mode") === "feed");
    log(`§6.2 feed cards rendered: ${cards.length} · all uniform SlateCard(compact, mode=feed): ${allFeed}`);
    expect(cards.length).toBe(3);
    expect(allFeed).toBe(true);
    // each shows the pot figures (pool + 1st) and creator eyebrow — the compact contract.
    expect(cards[0]!.querySelector("[data-pool]")).not.toBeNull();
    expect(cards[0]!.querySelector("[data-creator]")).not.toBeNull();

    // §6.3 — no rake string anywhere on Explore.
    const html = el.innerHTML.toLowerCase();
    const rakeHits = (html.match(/rake/g) || []).length;
    log(`§6.3 "rake" occurrences in the Explore DOM: ${rakeHits}`);
    expect(rakeHits).toBe(0);
    expect(html).toContain("prize pool"); // pool DOES render

    // §6.4 — the feed column carries bottom clearance (pb-*) so cards clear the nav + FABs.
    const root = el.firstElementChild as HTMLElement;
    const cls = root.getAttribute("class") || "";
    log(`§6.4 feed root clearance class present (pb-36): ${cls.includes("pb-36")} · class="${cls.split(" ").filter((c) => c.startsWith("pb-")).join(" ")}"`);
    expect(/\bpb-\d/.test(cls)).toBe(true);

    // §6.5 — ONE visible filter row: the category chips. Currency (Paid/Free) + stake are BEHIND the
    // single filter control (no filter panel until it's opened).
    const filterControl = el.querySelector("[data-filter-control]") as HTMLElement;
    const panelBefore = el.querySelector("[data-filter-panel]");
    log(`§6.5 filter control present: ${!!filterControl} · currency/stake panel visible before open: ${!!panelBefore}`);
    expect(filterControl).not.toBeNull();
    expect(panelBefore).toBeNull(); // stake/currency NOT a second visible row
    act(() => filterControl.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const panelAfter = el.querySelector("[data-filter-panel]");
    log(`§6.5 panel visible after opening the single control: ${!!panelAfter}`);
    expect(panelAfter).not.toBeNull();

    // §4.3 — "Popular right now" is a section label (For You tab), not a per-card badge.
    const label = [...el.querySelectorAll("h2")].find((n) => /popular right now/i.test(n.textContent || ""));
    log(`§4.3 "Popular right now" section label present: ${!!label}`);
    expect(label).toBeTruthy();
  });

  it("a withheld slate still renders as a SlateCard (under review), never banned legs", () => {
    const el = mount(h(ExploreFeed, { initialSlates: [slate({ id: "w1", withheld: true, predictions: [] })], signals: SIGNALS }));
    const card = el.querySelector('[data-compact][data-withheld="true"]') as HTMLElement;
    log(`§compliance withheld card is a SlateCard instance: ${!!card} · shows "under review": ${/under review/i.test(el.innerHTML)}`);
    expect(card).not.toBeNull();
    expect(card.querySelector("[data-pool]")).toBeNull(); // no pool/legs on a withheld card
  });
});
