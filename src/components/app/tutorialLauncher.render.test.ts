/**
 * LOCKSMITH SCREEN — RENDERED behaviour:
 *   · the floating door is ABSENT; START PLAYING is present and is a functional button
 *   · the chip dock renders (data chips) and PERSISTS when the desk image is minimized
 *   · tapping a chip SENDS that question as the user's message
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement as h, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// next/link → plain anchor (no app-router invariant in tests).
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => h("a", { href }, children),
}));
// speech + the server action → inert (no capacitor / firebase-admin import chains).
vi.mock("@/lib/speech", () => ({
  sttSupported: async () => false,
  startStt: async () => null,
}));
vi.mock("@/app/app/tutorial/actions", () => ({ markTutorialSeen: vi.fn(async () => {}) }));

import { TutorialLauncher } from "./TutorialLauncher";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// fetch → resolves immediately with an empty stream so the auto-walkthrough finishes (pending=false).
beforeEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => ({
    ok: true,
    body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
  }));
  // jsdom implements neither scrollTo (transcript auto-scroll) — no-op it.
  (Element.prototype as unknown as { scrollTo: () => void }).scrollTo = () => {};
});

async function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(h(TutorialLauncher, { mode: "advanced", initialSeen: false }));
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { host, root };
}

function buttons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll("button"));
}

describe("floating door removed; START PLAYING present + functional", () => {
  it("no door element, but a working START PLAYING button", async () => {
    const { host, root } = await mount();

    expect(host.querySelector('[aria-label="Start playing — step through the door"]')).toBeNull();

    const startBtn = buttons(host).find((b) => /start/i.test(b.textContent || "") && /playing/i.test(b.textContent || ""));
    expect(startBtn).toBeTruthy();
    expect(startBtn!.tagName).toBe("BUTTON");

    act(() => root.unmount());
    host.remove();
  });
});

describe("chip dock renders, persists through minimize, and sends on tap", () => {
  it("shows data chips, keeps them after minimizing, and a tap posts the question", async () => {
    const { host, root } = await mount();

    const chipText = "What's the Championship?";
    const findChip = () => buttons(host).find((b) => (b.textContent || "").trim() === chipText);
    expect(findChip()).toBeTruthy();

    const chevron = host.querySelector('[aria-label="Hide the Locksmith"]') as HTMLButtonElement;
    expect(chevron).toBeTruthy();
    await act(async () => {
      chevron.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(findChip()).toBeTruthy(); // persisted through minimize

    await act(async () => {
      findChip()!.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    expect(host.textContent).toContain(chipText);

    act(() => root.unmount());
    host.remove();
  });
});
