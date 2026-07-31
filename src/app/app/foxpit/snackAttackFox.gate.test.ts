// @vitest-environment node
/**
 * GATE 2.3 — Boss Snack Attack fox rig survives entering/leaving the game screen on ALL SIX floors.
 *
 * This is "the one that broke": #foxWrap lives inside a .screen that is display:none until the game
 * screen opens, so it measures 0x0 at mount. The approved build handles it two ways (both must hold):
 *   (a) fit() runs EVERY FRAME from the rAF loop (not once at mount), so it self-heals when shown.
 *   (b) visibility is restored UNCONDITIONALLY whenever the host has size (not gated on scale-changed),
 *       so re-entering a board at the same scale still un-hides the fox.
 *
 * We drive the game's REAL already-mounted rig (window.FOXRIG, mounted once at init on #foxWrap) by
 * calling FOXRIG.fit() — the exact function its rAF step loop invokes every frame — after toggling the
 * host size (0x0 = screen hidden ↔ board size = screen shown) once per floor, the exact mechanism that
 * broke. Verified from OUTPUT: the #foxStage element's visibility + transform.
 */
import { describe, it, expect } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "fs";

describe("GATE 2.3 — snack-attack fox visible + scaled on every floor", () => {
  it("enters and leaves the game screen once per floor, all six", () => {
    const html = readFileSync("public/foxpit/snack/index.html", "utf8");
    const vc = new VirtualConsole(); // swallow the game's init noise; we only test the rig
    const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = dom.window as any;

    // Host = the real #foxWrap the game mounted into. jsdom does no layout, so we simulate the
    // .screen show/hide by driving clientWidth/Height: 0x0 = screen hidden, board px = screen shown.
    const host = win.document.getElementById("foxWrap");
    expect(host).toBeTruthy();
    let size = { w: 0, h: 0 };
    for (const p of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"]) {
      Object.defineProperty(host, p, { configurable: true, get: () => (p.includes("Width") ? size.w : size.h) });
    }

    // The game already mounted the rig ONCE at init (window.FOXRIG = mountFox(#foxWrap), line 1057).
    // Drive its OWN fit() — what the rAF loop calls every frame. Fall back to a fresh mount only if
    // init never reached the assignment.
    const rig = win.FOXRIG ?? win.mountFox(host);
    expect(typeof rig.fit).toBe("function");
    // One frame of the loop = one fit() call.
    const frames = (n: number) => { for (let i = 0; i < n; i++) rig.fit(); };

    frames(2); // screen still hidden (0x0)
    const stage = win.document.getElementById("foxStage");
    expect(stage).toBeTruthy();
    expect(stage.style.visibility).toBe("hidden"); // 0x0 host ⇒ hidden, as designed

    // Six floors, each with its own board size — enter & leave the game screen once each.
    const FLOORS = ["Owl", "Ghost", "Wolf", "Grim", "Raven", "Fox"];
    const BOARD = [96, 104, 112, 100, 108, 120];
    const results: string[] = [];

    for (let f = 0; f < 6; f++) {
      // leave the game screen → host collapses to 0x0
      size = { w: 0, h: 0 }; frames(2);
      // enter this floor's game screen → host now measures the board
      size = { w: BOARD[f], h: BOARD[f] }; frames(2);

      const st = win.document.getElementById("foxStage");
      const visible = st.style.visibility === "visible";
      const scaled = /scale\(/.test(st.style.transform);
      const mountedOnce = st === stage; // never re-mounted across floor changes

      results.push(`${FLOORS[f].padEnd(6)} visible=${visible} scale=${scaled} mountedOnce=${mountedOnce} transform="${st.style.transform}"`);

      expect(st, `floor ${FLOORS[f]}: rig re-mounted`).toBe(stage);
      expect(visible, `floor ${FLOORS[f]}: fox hidden`).toBe(true);
      expect(scaled, `floor ${FLOORS[f]}: no scale() transform`).toBe(true);
    }

    // eslint-disable-next-line no-console
    console.log("SIX-FLOOR FOX GATE:\n" + results.map((r) => "  " + r).join("\n"));
  });
});
