// @vitest-environment jsdom
/**
 * B GATE — the reveal must never render blank. With an EMPTY ledger, assert explicit text is
 * visible and the continue control fires onDone.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
// FoxPitGame pulls in server actions (../../actions -> firebase-admin) — mock the boundary.
vi.mock("../../actions", () => ({ applyFoxPitCoins: async () => ({}), dealFoxRound: async () => ({ ok: true, slates: [] }) }));
import { RevealPhase } from "./FoxPitGame";

describe("RevealPhase empty ledger (B)", () => {
  it("empty ledger → explicit text + working continue (never blank)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const onDone = vi.fn();
    flushSync(() =>
      createRoot(el).render(h(RevealPhase as never, { slates: [], picks: {}, ledger: [], net: 0, accent: "#c22b22", onDone } as never)),
    );
    const empty = el.querySelector("[data-reveal-empty]");
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toContain("nothing to settle");
    // the reveal is NOT blank — it has visible text
    expect((el.textContent || "").trim().length).toBeGreaterThan(20);
    // continue control works
    const cont = [...el.querySelectorAll("button")].find((b) => /hear the call/i.test(b.textContent || ""));
    expect(cont).toBeTruthy();
    flushSync(() => cont!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDone).toHaveBeenCalled();
  });
});
