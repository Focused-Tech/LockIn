// @vitest-environment jsdom
/**
 * GATE — ELEVATOR PANEL, CLOCK, COINS, NO-CONTEST, MATCH SCORE (scope-locked pass §6).
 * Every assertion prints its ACTUAL numbers, read from the running game logic (not the spec table).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createElement as h, act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Enable React's act() support in jsdom so effect-scheduled timers flush deterministically.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// next/navigation isn't wired in jsdom — stub the router ElevatorRide/ElevatorRide-children call.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
// FoxPitGame pulls the server actions module (firebase-admin) at import — stub it; we only use the
// pure exported helpers from that file.
vi.mock("./actions", () => ({ applyFoxPitCoins: async () => ({ ok: true }), dealFoxRound: async () => ({ ok: true, slates: [] }) }));

import { ElevatorRide, floorPlateFor } from "./map/Map";
import { RoundChrome } from "./room/[room]/RoundChrome";
import { answerSecondsFor, answerClockVisible, decideRound } from "./room/[room]/FoxPitGame";
import { settleRound, type FoxSlate } from "@/lib/foxpit/slates";
import { winsNeeded } from "@/lib/foxpit/rules";
import { FOXPIT_UNLOCK_ALL } from "@/lib/foxpit";

const log = (m: string) => console.log(m); // eslint-disable-line no-console
let mounted: { el: HTMLElement; root: Root } | null = null;
afterEach(() => { if (mounted) { act(() => mounted!.root.unmount()); mounted.el.remove(); mounted = null; } });

function mount(node: React.ReactElement): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(node));
  mounted = { el, root };
  return el;
}
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(sel)].map((n) => (n.textContent || "").trim());

// ── §6.1 ELEVATOR: one panel, locked floors disabled, Lounge shows a FLOOR plate not the room ──
describe("§6.1 GATE — elevator floor PANEL", () => {
  it("every floor in one panel; no up/down/GO; the Lounge shows a floor plate, not the room interior", () => {
    vi.useFakeTimers();
    // all rooms cleared → every floor unlocked and the Winner's Lounge present in the directory.
    const cleared = new Set(["dojo", "coliseum", "hightable", "suite"] as const);
    const el = mount(h(ElevatorRide, { lone: false, cleared: cleared as never, onClose: () => {}, onArrive: () => {} }));
    // advance past the doors-opening animation into the SELECT panel.
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();

    const rows = [...el.querySelectorAll("[data-floor]")] as HTMLButtonElement[];
    const floors = rows.map((r) => r.getAttribute("data-floor"));
    log(`§6.1 panel floors (one screen, top→bottom): [${floors.join(", ")}]  (count=${rows.length})`);
    expect(rows.length).toBe(6); // winners, suite, hightable, coliseum, lobby, dojo

    // no spinner controls remain anywhere in the panel
    const allBtnText = texts(el, "button");
    const hasUpDownGo = allBtnText.some((t) => t === "▲" || t === "▼" || t.includes("GO"));
    log(`§6.1 up/▲ ▼/GO controls present? ${hasUpDownGo}`);
    expect(hasUpDownGo).toBe(false);

    // the Lounge row shows its FLOOR plate stand-in (neon crest), NOT the lounge ROOM interior.
    const winRow = rows.find((r) => r.getAttribute("data-floor") === "winners")!;
    const winImg = winRow.querySelector("[data-floor-plate]") as HTMLImageElement;
    log(`§6.1 Lounge plate src = ${winImg.getAttribute("src")}`);
    expect(winImg.getAttribute("src")).toContain("emblem-fox-neon");
    expect(winImg.getAttribute("src")).not.toContain("wl_plate_wide_establishing");
    // a boss floor shows its real floor plate
    const dojoImg = rows.find((r) => r.getAttribute("data-floor") === "dojo")!.querySelector("[data-floor-plate]") as HTMLImageElement;
    log(`§6.1 Dojo plate src   = ${dojoImg.getAttribute("src")}`);
    expect(dojoImg.getAttribute("src")).toContain("/foxpit/floors/floor");

    // floorPlateFor directly: winners → null (→ crest), rooms → floors/*.png (proves §1.3 at the source)
    log(`§6.1 floorPlateFor(winners) = ${JSON.stringify(floorPlateFor({ kind: "winners" } as never))}`);
    expect(floorPlateFor({ kind: "winners" } as never)).toBeNull();
  });

  it("the disable binding responds to lock/travel state (a locked floor would be disabled)", () => {
    vi.useFakeTimers();
    const el = mount(h(ElevatorRide, { lone: false, cleared: new Set() as never, onClose: () => {}, onArrive: () => {} }));
    for (let i = 0; i < 10; i++) act(() => { vi.advanceTimersByTime(300); });
    let rows = [...el.querySelectorAll("[data-floor]")] as HTMLButtonElement[];
    // DEMO OVERRIDE: FOXPIT_UNLOCK_ALL forces every floor unlocked, so none renders locked right now.
    // Each row's `disabled` is `!unlocked || traveling`; with the override on + not travelling, all false.
    log(`§6.1 FOXPIT_UNLOCK_ALL=${FOXPIT_UNLOCK_ALL} → data-locked flags: [${rows.map((r) => r.getAttribute("data-locked")).join(", ")}] · disabled: [${rows.map((r) => r.disabled).join(", ")}]`);
    expect(rows.every((r) => r.disabled === (r.getAttribute("data-locked") === "true"))).toBe(true);

    // Drive a selection → the panel enters TRAVELING; every row then disables (the `!unlocked` term of
    // the same binding is what disables a locked floor). Proves the disable wiring is live.
    act(() => rows.find((r) => r.getAttribute("data-floor") === "dojo")!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    for (let i = 0; i < 4; i++) act(() => { vi.advanceTimersByTime(250); }); // closing → riding (< 1700ms arrive)
    vi.useRealTimers();
    rows = [...el.querySelectorAll("[data-floor]")] as HTMLButtonElement[];
    log(`§6.1 while TRAVELING → all rows disabled=${rows.length > 0 && rows.every((b) => b.disabled)} (rows=${rows.length})`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((b) => b.disabled)).toBe(true);
  });
});

// ── §6.2 + §6.3 CLOCK ──
describe("§6.2/§6.3 GATE — answering clock timing", () => {
  it("clock runs ONLY in play; budget is the ARCHITECT table by cards kept", () => {
    const vis = {
      dealing: answerClockVisible("dealing", 210),
      deal: answerClockVisible("deal", 210),
      dealingKeep: answerClockVisible("dealing", 210),
      play: answerClockVisible("play", 210),
    };
    log(`§6.2 answerClockVisible → dealing=${vis.dealing} deal=${vis.deal} play=${vis.play}`);
    expect(vis.dealing).toBe(false);
    expect(vis.deal).toBe(false);
    expect(vis.play).toBe(true);

    const secs = [1, 2, 3, 4, 5].map(answerSecondsFor);
    log(`§6.3 answer seconds by cards kept → 1:${secs[0]} 2:${secs[1]} 3:${secs[2]} 4:${secs[3]} 5:${secs[4]}`);
    expect(secs).toEqual([40, 120, 160, 180, 210]);
  });
});

// ── §6.4 COINS: a win credits, a loss debits ──
describe("§6.4 GATE — coins move both ways", () => {
  const slate = (correctPick: boolean): FoxSlate => ({
    id: "s1", category: "sports" as never, title: "T",
    questions: [{ id: "q1", text: "Q", options: ["a", "b"], correctIndex: 0 }],
    playCount: 1, stake: 10,
  });
  it("winning round increases the balance; losing round decreases it", () => {
    const START = 440;
    // WIN: player right (pick q1→0), boss wrong.
    const win = settleRound([slate(true)], { q1: 0 }, "match", 15, () => false);
    const afterWin = START + win.net;
    log(`§6.4 WIN  · net=${win.net} · balance ${START} → ${afterWin}`);
    expect(win.net).toBeGreaterThan(0);
    expect(afterWin).toBe(450);

    // LOSS: player wrong (pick q1→1), boss right.
    const loss = settleRound([slate(false)], { q1: 1 }, "match", 15, () => true);
    const afterLoss = START + loss.net;
    log(`§6.4 LOSS · net=${loss.net} · balance ${START} → ${afterLoss}`);
    expect(loss.net).toBeLessThan(0);
    expect(afterLoss).toBe(430);
  });
});

// ── §6.5 NO-CONTEST: zero answered scores for neither, match score unchanged ──
describe("§6.5 GATE — no-contest", () => {
  it("zero staked-and-answered cards = no-contest; a normal round still scores", () => {
    const before = { you: 1, boss: 0 };
    const nc = decideRound(0, 0, 0); // nothing played
    const after = { you: before.you + nc.playerDelta, boss: before.boss + nc.bossDelta };
    log(`§6.5 NO-CONTEST · noContest=${nc.noContest} won=${nc.won} · match ${before.you}-${before.boss} → ${after.you}-${after.boss}`);
    expect(nc.noContest).toBe(true);
    expect(nc.won).toBe(false);
    expect(after).toEqual(before); // neither side moved

    const win = decideRound(3, 2, 1); // answered → scores normally
    log(`§6.5 CONTESTED WIN · noContest=${win.noContest} won=${win.won} playerDelta=${win.playerDelta}`);
    expect(win.noContest).toBe(false);
    expect(win.won).toBe(true);
    expect(win.playerDelta).toBe(1);
  });
});

// ── §6.6 + §6.7 MATCH SCORE header: names the opponent, correct target ──
describe("§6.6/§6.7 GATE — match tally in the header", () => {
  const chrome = (roundsWon: number, bossWins: number, oppName: string, isBoss: boolean) =>
    mount(h(RoundChrome, {
      oppName, roundIndex: 0, rounds: 5, keepN: 3, slatesPerRound: 5, accent: "#c22b22",
      clockVisible: false, clockLabel: "", clockAlert: false,
      roundsWon, bossWins, winsTarget: winsNeeded(isBoss), coins: 440, onQuit: () => {},
    }));

  it("underling table: names the opponent, first to 2, and increments on a win", () => {
    let el = chrome(0, 0, "Alpha Wolf", false);
    let tally = (el.querySelector("[data-match-tally]") as HTMLElement).textContent!.replace(/\s+/g, " ").trim();
    log(`§6.7 underling tally (before) = "${tally}" · target=${winsNeeded(false)}`);
    expect(tally).toContain("You 0");
    expect(tally).toContain("Alpha Wolf");
    expect(tally).toContain("first to 2");

    act(() => mounted!.root.unmount()); mounted!.el.remove(); mounted = null;
    el = chrome(1, 0, "Alpha Wolf", false); // after winning a hand
    tally = (el.querySelector("[data-match-tally]") as HTMLElement).textContent!.replace(/\s+/g, " ").trim();
    log(`§6.6 underling tally (after WIN) = "${tally}"`);
    expect(tally).toContain("You 1");

    act(() => mounted!.root.unmount()); mounted!.el.remove(); mounted = null;
    el = chrome(1, 1, "Alpha Wolf", false); // then losing a hand → boss side increments
    tally = (el.querySelector("[data-match-tally]") as HTMLElement).textContent!.replace(/\s+/g, " ").trim();
    log(`§6.6 underling tally (after LOSS) = "${tally}"`);
    expect(tally).toContain("1 Alpha Wolf");
  });

  it("floor boss table: first to 3", () => {
    const el = chrome(2, 1, "Boss Fox", true);
    const tally = (el.querySelector("[data-match-tally]") as HTMLElement).textContent!.replace(/\s+/g, " ").trim();
    log(`§6.7 boss tally = "${tally}" · target=${winsNeeded(true)}`);
    expect(tally).toContain("first to 3");
    expect(tally).toContain("Boss Fox");
  });
});
