// @vitest-environment jsdom
/**
 * GATE — BALANCE MASK. The figure renders masked by default, the eye reveals it, and a remount
 * (leaving the screen and returning) re-hides it. Also asserts the header carries no cash balance.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createElement as h, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MaskedAmount } from "./MaskedAmount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { el: HTMLElement; root: Root } | null = null;
afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.el.remove();
    mounted = null;
  }
});

function mount(node: React.ReactElement): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  mounted = { el, root };
  return el;
}

const log = (m: string) => console.log(m); // eslint-disable-line no-console

describe("balance mask", () => {
  it("masked by default, reveals on eye tap, re-hides on remount", () => {
    const el = mount(h(MaskedAmount, { value: "$42.00", className: "v cash" }));
    const figure = () => el.querySelector(".v")!.textContent ?? "";
    log(`mount → figure shows: "${figure()}"`);
    expect(figure()).toBe("••••••");

    const eye = el.querySelector("button")!;
    act(() => eye.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    log(`after eye tap → figure shows: "${figure()}"`);
    expect(figure()).toBe("$42.00");

    // "navigate away and back" == unmount + fresh mount; state is not remembered.
    act(() => mounted!.root.unmount());
    const el2 = mount(h(MaskedAmount, { value: "$42.00", className: "v cash" }));
    const figure2 = el2.querySelector(".v")!.textContent ?? "";
    log(`remount → figure shows: "${figure2}"`);
    expect(figure2).toBe("••••••");
  });

  it("the header (TopNav) renders no cash balance", () => {
    const SRC = readFileSync(resolve(process.cwd(), "src/components/app/TopNav.tsx"), "utf8");
    const hasCash = /formatCents\s*\(/.test(SRC);
    log(`TopNav references formatCents (cash figure): ${hasCash}`);
    expect(hasCash).toBe(false);
  });
});
