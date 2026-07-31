// @vitest-environment jsdom
/**
 * DRIVE — the lounge LOCKER ROOM (a door off the lounge): plate + props render, the centre locker
 * opens on tap, and "‹ Lounge" returns to the lounge. (The lounge itself + its Snack Bar / Elevator
 * controls live in Map's WinnersLoungeArrival; the elevator direction is gated in winnersLounge.gate.)
 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { WinnersLoungeLocker } from "./WinnersLoungeLocker";

const buttons = (el: HTMLElement) => [...el.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean);
const imgs = (el: HTMLElement) => [...el.querySelectorAll("img")].map((i) => i.getAttribute("src") || "");

describe("DRIVE — the lounge locker room", () => {
  it("plate + props, the locker opens, and back returns to the lounge", () => {
    const log: string[] = [];
    const el = document.createElement("div");
    document.body.appendChild(el);
    let back = false;
    const root = createRoot(el);
    flushSync(() => root.render(h(WinnersLoungeLocker, { onBack: () => { back = true; } })));

    const plate = imgs(el).find((s) => s.includes("locker_room_lounge"));
    const hasProps = imgs(el).some((s) => s.includes("boss_chair")) && imgs(el).some((s) => s.includes("coin_table"));
    log.push(`LOCKER ROOM  · backdrop=${plate?.split("/").pop()} · props=${hasProps} · buttons=[${buttons(el).join(", ")}]`);
    expect(plate, "locker room plate not rendered").toBeTruthy();
    expect(hasProps).toBe(true);

    // open the centre locker
    const doorShut = (el.querySelector("[data-locker-door]") as HTMLElement).style.transform;
    flushSync(() => (el.querySelector("[data-locker]") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const doorOpen = (el.querySelector("[data-locker-door]") as HTMLElement).style.transform;
    const interiorOpen = (el.querySelector("[data-locker-interior]") as HTMLElement).style.opacity;
    log.push(`OPEN LOCKER  · door ${doorShut} → ${doorOpen} · interior opacity=${interiorOpen}`);
    expect(doorOpen).not.toBe(doorShut);
    expect(interiorOpen).toBe("1");

    // back → returns to the lounge (onBack)
    const backBtn = [...el.querySelectorAll("button")].find((b) => (b.textContent || "").toLowerCase().includes("lounge"))!;
    flushSync(() => backBtn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    log.push(`BACK         · onBack (→ lounge) fired=${back}`);
    expect(back).toBe(true);

    // eslint-disable-next-line no-console
    console.log("LOCKER-ROOM DRIVE:\n" + log.map((l) => "  " + l).join("\n"));
    flushSync(() => root.unmount());
    el.remove();
  });
});
