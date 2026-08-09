/**
 * ACCOUNT DRAWER — role entries are flag-gated (Portal-trap fix D):
 *   · no flags → neither "Keyholder portal" nor "Admin"
 *   · keyholder → "Keyholder portal" only
 *   · admin → "Admin" only
 *   · Sign out is always present
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { createElement as h, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => h("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/firebase/auth", () => ({ logoutUser: vi.fn(async () => {}) }));

import { AccountMenu } from "./AccountMenu";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function openMenu(props: { username: string; isKeyholder?: boolean; isKeymaster?: boolean; isAdmin?: boolean }) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(h(AccountMenu, props)));
  const avatar = host.querySelector('[aria-label="Account menu"]') as HTMLButtonElement;
  act(() => avatar.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
  const labels = Array.from(host.querySelectorAll('[role="menuitem"]')).map((e) => (e.textContent || "").trim());
  const cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { labels, cleanup };
}

describe("account drawer role entries", () => {
  it("no flags → no role entries, but Sign out is present", () => {
    const { labels, cleanup } = openMenu({ username: "u" });
    expect(labels.some((l) => /Keyholder portal/.test(l))).toBe(false);
    expect(labels.some((l) => l === "Admin" || /^Admin/.test(l))).toBe(false);
    expect(labels.some((l) => /Sign out/.test(l))).toBe(true);
    expect(labels.some((l) => /Profile/.test(l))).toBe(true);
    cleanup();
  });
  it("keyholder → 'Keyholder portal' only", () => {
    const { labels, cleanup } = openMenu({ username: "u", isKeyholder: true });
    expect(labels.some((l) => /Keyholder portal/.test(l))).toBe(true);
    expect(labels.some((l) => /^Admin/.test(l))).toBe(false);
    cleanup();
  });
  it("admin → 'Admin' only", () => {
    const { labels, cleanup } = openMenu({ username: "u", isAdmin: true });
    expect(labels.some((l) => /^Admin/.test(l))).toBe(true);
    expect(labels.some((l) => /Keyholder portal/.test(l))).toBe(false);
    cleanup();
  });
  it("keymaster → 'Keymaster portal' as home, NOT the keyholder portal", () => {
    const { labels, cleanup } = openMenu({ username: "u", isKeyholder: true, isKeymaster: true });
    expect(labels.some((l) => /Keymaster portal/.test(l))).toBe(true);
    expect(labels.some((l) => /Keyholder portal/.test(l))).toBe(false);
    cleanup();
  });
  it("both flags → both entries", () => {
    const { labels, cleanup } = openMenu({ username: "u", isKeyholder: true, isAdmin: true });
    expect(labels.some((l) => /Keyholder portal/.test(l))).toBe(true);
    expect(labels.some((l) => /^Admin/.test(l))).toBe(true);
    cleanup();
  });
});
