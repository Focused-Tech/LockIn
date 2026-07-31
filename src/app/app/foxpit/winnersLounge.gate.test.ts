// @vitest-environment jsdom
/**
 * GATE §2.5 + §3.4 — Winner's Lounge locker + elevator.
 *
 * §2.5 the three locker pieces share ONE box; the interior is hidden at shut and visible at open; a
 *      real tap changes the door's transform.
 * §3.4 the elevator car renders INSIDE the arch opening bounds (never over the surrounding panelling).
 */
import { describe, it, expect } from "vitest";
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LockerDoor, ElevatorCorridor, CAR_BOX, ARCH_OPENING } from "./WinnersLoungeLocker";

function mount(el: HTMLElement, node: React.ReactElement) {
  const root = createRoot(el);
  flushSync(() => root.render(node));
  return root;
}

describe("GATE §2.5 — locker opens", () => {
  it("three pieces share one box; interior hidden→visible; tap changes the door transform", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    // stateful wrapper so a real tap toggles open (like the room does)
    function Harness() {
      const [open, setOpen] = useState(false);
      return h(LockerDoor, { open, onToggle: () => setOpen((v) => !v) });
    }
    const root = mount(el, h(Harness));

    const box = el.querySelector("[data-locker]") as HTMLElement;
    const interior = el.querySelector("[data-locker-interior]") as HTMLElement;
    const door = el.querySelector("[data-locker-door]") as HTMLElement;
    const closed = el.querySelector("[data-locker-closed]") as HTMLElement;
    expect(box && interior && door && closed).toBeTruthy();

    // §2.5a — identical box: all three fill the same container (inset 0, 100%×100%)
    for (const piece of [interior, door, closed]) {
      expect(piece.style.position).toBe("absolute");
      expect(piece.style.width).toBe("100%");
      expect(piece.style.height).toBe("100%");
      expect(piece.style.inset).toBe("0px");
    }

    // §2.5b — interior hidden while shut
    expect(interior.style.opacity).toBe("0");
    const shutTransform = door.style.transform;

    // §2.5c — drive a REAL tap on the locker
    flushSync(() => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const interiorAfter = el.querySelector("[data-locker-interior]") as HTMLElement;
    const doorAfter = el.querySelector("[data-locker-door]") as HTMLElement;
    expect(interiorAfter.style.opacity).toBe("1"); // visible at open
    expect(doorAfter.style.transform).not.toBe(shutTransform); // door transform changed
    expect(doorAfter.style.transform).toContain("rotateY(-105deg)");

    // eslint-disable-next-line no-console
    console.log(`LOCKER: shut door="${shutTransform}" → open door="${doorAfter.style.transform}"; interior 0→${interiorAfter.style.opacity}`);
    flushSync(() => root.unmount());
    el.remove();
  });
});

describe("GATE §3.4 — car inside the arch", () => {
  it("the car box sits within the arch opening (no panelling overlap)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = mount(el, h(ElevatorCorridor, { onBack: () => {} }));

    const car = el.querySelector("[data-elevator-car]") as HTMLElement;
    expect(car).toBeTruthy();
    const left = parseFloat(car.style.left);
    const width = parseFloat(car.style.width);
    const right = left + width;

    // horizontal: fully inside the arch opening
    expect(left).toBeGreaterThanOrEqual(ARCH_OPENING.leftPct);
    expect(right).toBeLessThanOrEqual(ARCH_OPENING.rightPct);
    // top: at/under the arch dome start, above the floor
    expect(CAR_BOX.topPct).toBeGreaterThanOrEqual(ARCH_OPENING.topPct);
    expect(CAR_BOX.topPct).toBeLessThan(ARCH_OPENING.bottomPct);

    // eslint-disable-next-line no-console
    console.log(`CAR: x ${left}%–${right.toFixed(1)}% within arch ${ARCH_OPENING.leftPct}%–${ARCH_OPENING.rightPct}% · top ${CAR_BOX.topPct}%`);
    flushSync(() => root.unmount());
    el.remove();
  });
});
