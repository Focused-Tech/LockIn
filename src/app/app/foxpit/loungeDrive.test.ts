// @vitest-environment jsdom
/**
 * DRIVE — run the REAL mounted Winner's Lounge: arrive at the locker room, open the centre locker,
 * step into the elevator corridor, come back. Logs each beat so the path is verifiable end-to-end.
 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { WinnersLoungeLocker } from "./WinnersLoungeLocker";

const buttons = (el: HTMLElement) =>
  [...el.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean);
const clickText = (el: HTMLElement, t: string) => {
  const b = [...el.querySelectorAll("button")].find((x) => (x.textContent || "").toLowerCase().includes(t.toLowerCase()));
  if (!b) throw new Error(`no button matching "${t}" — have: ${buttons(el).join(" | ")}`);
  flushSync(() => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
};
const imgs = (el: HTMLElement) => [...el.querySelectorAll("img")].map((i) => i.getAttribute("src") || "");

describe("DRIVE — elevator → Winner's Lounge → locker room", () => {
  it("runs the whole path", () => {
    const log: string[] = [];
    const el = document.createElement("div");
    document.body.appendChild(el);
    let back = false;
    const root = createRoot(el);
    // Returning winner (Boss Fox beaten) lands straight on the lounge locker room (Map's lounge home).
    flushSync(() => root.render(h(WinnersLoungeLocker, { coins: 0, unlockedRooms: [], bossFoxBeaten: true, onBack: () => { back = true; } })));

    // BEAT 1 — the locker room
    const plate1 = imgs(el).find((s) => s.includes("locker_room_lounge"));
    const hasProps = imgs(el).some((s) => s.includes("boss_chair")) && imgs(el).some((s) => s.includes("coin_table"));
    const phoneLit = (el.querySelector("[data-snackphone]") as HTMLElement)?.getAttribute("data-lit");
    log.push(`LOCKER ROOM  · backdrop=${plate1?.split("/").pop()} · props=${hasProps} · snackphone lit=${phoneLit} · buttons=[${buttons(el).join(", ")}]`);
    expect(plate1, "locker room plate not rendered").toBeTruthy();
    expect(hasProps).toBe(true);

    // BEAT 2 — open the centre locker (tap it)
    const locker = el.querySelector("[data-locker]") as HTMLElement;
    const doorShut = (el.querySelector("[data-locker-door]") as HTMLElement).style.transform;
    flushSync(() => locker.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    const doorOpen = (el.querySelector("[data-locker-door]") as HTMLElement).style.transform;
    const interiorOpen = (el.querySelector("[data-locker-interior]") as HTMLElement).style.opacity;
    log.push(`OPEN LOCKER  · door ${doorShut} → ${doorOpen} · interior opacity=${interiorOpen}`);
    expect(doorOpen).not.toBe(doorShut);
    expect(interiorOpen).toBe("1");

    // BEAT 3 — into the elevator corridor
    clickText(el, "Elevator");
    const carSrc = imgs(el).find((s) => s.includes("elevator_car"));
    const car = el.querySelector("[data-elevator-car]") as HTMLElement;
    log.push(`ELEVATOR     · corridor=${imgs(el).find((s) => s.includes("elevator_corridor"))?.split("/").pop()} · car=${carSrc?.split("/").pop()} @ left ${car.style.left}, top ${car.style.top}, w ${car.style.width} · buttons=[${buttons(el).join(", ")}]`);
    expect(car, "elevator car not rendered").toBeTruthy();

    // BEAT 4 — back to the locker room, then out to the map
    clickText(el, "Locker room");
    log.push(`BACK         · ${imgs(el).some((s) => s.includes("locker_room_lounge")) ? "locker room again" : "?"}`);
    clickText(el, "Map");
    log.push(`EXIT         · onBack fired=${back}`);
    expect(back).toBe(true);

    // eslint-disable-next-line no-console
    console.log("RUN-THROUGH:\n" + log.map((l) => "  " + l).join("\n"));
    flushSync(() => root.unmount());
    el.remove();
  });
});
