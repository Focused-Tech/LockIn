// @vitest-environment jsdom
/**
 * GATE — Winner's Lounge locker + elevator + furniture.
 *   §2.5 locker opens (drive the real LockerDoor).
 *   §3.1–3.4 the MEASURED car + furniture boxes satisfy the architect's plate coordinates.
 */
import { describe, it, expect } from "vitest";
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LockerDoor, CAR_PX, ARCH_PX, FURNITURE_PX, LOCKER_RECT_PX } from "./WinnersLoungeLocker";

interface Box { left: number; top: number; width: number; height: number }
const intersects = (a: Box, b: Box) =>
  a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

describe("GATE §2.5 — locker opens", () => {
  it("three pieces share one box; interior hidden→visible; tap changes the door transform", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    function Harness() {
      const [open, setOpen] = useState(false);
      return h(LockerDoor, { open, onToggle: () => setOpen((v) => !v) });
    }
    const root = createRoot(el);
    flushSync(() => root.render(h(Harness)));
    const door = el.querySelector("[data-locker-door]") as HTMLElement;
    const interior = el.querySelector("[data-locker-interior]") as HTMLElement;
    expect(interior.style.opacity).toBe("0");
    const shut = door.style.transform;
    flushSync(() => (el.querySelector("[data-locker]") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect((el.querySelector("[data-locker-interior]") as HTMLElement).style.opacity).toBe("1");
    expect((el.querySelector("[data-locker-door]") as HTMLElement).style.transform).not.toBe(shut);
    flushSync(() => root.unmount());
    el.remove();
  });
});

describe("GATE §3 — measured car + furniture boxes", () => {
  const results: string[] = [];

  it("§3.1 — car box is 296×841 and its bottom sits at y1403", () => {
    const bottom = CAR_PX.top + CAR_PX.height;
    results.push(`§3.1 car ${CAR_PX.width}×${CAR_PX.height}, left ${CAR_PX.left}, top ${CAR_PX.top}, bottom ${bottom}`);
    expect(CAR_PX.width).toBe(296);
    expect(CAR_PX.height).toBe(841);
    expect(bottom).toBe(1403);
  });

  it("§3.2 — car box is fully inside the arch bounds x251–547", () => {
    const right = CAR_PX.left + CAR_PX.width;
    results.push(`§3.2 car x ${CAR_PX.left}–${right} within arch ${ARCH_PX.left}–${ARCH_PX.right}`);
    expect(CAR_PX.left).toBeGreaterThanOrEqual(ARCH_PX.left);
    expect(right).toBeLessThanOrEqual(ARCH_PX.right);
  });

  it("§3.3 — both furniture boxes: x>613, y>1044, y+h<1442", () => {
    for (const [name, f] of Object.entries(FURNITURE_PX)) {
      const right = f.left + f.width, bottom = f.top + f.height;
      results.push(`§3.3 ${name} x ${f.left}–${right}, y ${f.top}–${bottom} (scale ${f.scale})`);
      expect(f.left, `${name}.left`).toBeGreaterThan(613);
      expect(f.top, `${name}.top`).toBeGreaterThan(1044);
      expect(bottom, `${name}.bottom`).toBeLessThan(1442);
    }
  });

  it("§3.4 — neither furniture box intersects the centre locker rect", () => {
    for (const [name, f] of Object.entries(FURNITURE_PX)) {
      const hit = intersects(f, LOCKER_RECT_PX);
      results.push(`§3.4 ${name} ∩ locker(${LOCKER_RECT_PX.left},${LOCKER_RECT_PX.top},${LOCKER_RECT_PX.width},${LOCKER_RECT_PX.height}) = ${hit}`);
      expect(hit, `${name} overlaps the locker`).toBe(false);
    }
  });

  it("prints §3.5 results", () => {
    // eslint-disable-next-line no-console
    console.log("LOUNGE GATE §3:\n" + results.map((r) => "  " + r).join("\n"));
    expect(results.length).toBeGreaterThanOrEqual(6);
  });
});
