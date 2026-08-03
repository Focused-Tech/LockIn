/**
 * §8 GATE — the Creator hub, compared not checked. Mounts the REAL <CreatorBuilder/>, dispatches REAL
 * clicks on REAL elements, and asserts RENDERED STRUCTURE against the spec file
 * (public/design/Creator Builder/creator_builder.html) — same tags, class names, nesting, order — then
 * prints computed values: the one-view + chrome invariants in all six states, the four tiles in order,
 * every tile's open/return, the builder step flow, the step-3 leg block/unblock, and that the practice
 * CTA never mounts a builder. `expect(views).toBe(1)` over `expect(hasHub).toBe(true)`.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
import { CreatorBuilder } from "./CreatorBuilder";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const log = (m: string) => console.log(m); // eslint-disable-line no-console
const SPEC = resolve(process.cwd(), "public/design/Creator Builder/creator_builder.html");

/** structural signature: tag + sorted class list, recursive — ignores text + attributes (§8). */
function sig(el: Element, d = 0): string {
  const cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).sort();
  const head = `${"  ".repeat(d)}${el.tagName.toLowerCase()}${cls.length ? "." + cls.join(".") : ""}`;
  return [head, ...Array.from(el.children).map((c) => sig(c, d + 1))].join("\n");
}

let root: ReturnType<typeof createRoot> | null = null;
function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(h(CreatorBuilder)));
  return host;
}
// Unmount + clear between tests so ids (#pRules/#leg2/…) stay unique and scoped clicks don't cross mounts.
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  pushMock.mockClear();
});
const cb = () => (window as unknown as { __cb: { step: number; view: string } }).__cb;
const q = (host: Element, s: string) => host.querySelector(s) as HTMLElement | null;
const vis = (el: HTMLElement | null) => !!el && el.style.display !== "none";
const onPanes = (host: Element) => Array.from(host.querySelectorAll(".pane.on")).map((p) => p.id);
const click = (el: Element | null) => act(() => { el?.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

describe("§8 Creator hub gate — structure + behavior vs the spec", () => {
  it("RENDERED STRUCTURE matches the spec #body (same tags, classes, nesting, order)", () => {
    const host = mount();
    const specDoc = new DOMParser().parseFromString(readFileSync(SPEC, "utf8"), "text/html");
    const specBody = sig(specDoc.querySelector("#body")!);
    const liveBody = sig(host.querySelector("#body")!);
    if (specBody !== liveBody) {
      const a = specBody.split("\n"), b = liveBody.split("\n");
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) log(`  diff@${i}\n    spec: ${a[i] ?? "∅"}\n    live: ${b[i] ?? "∅"}`);
    }
    log(`§8 structure: spec #body nodes=${specBody.split("\n").length}, live=${liveBody.split("\n").length}, EQUAL=${specBody === liveBody}`);
    expect(liveBody).toBe(specBody);
  });

  it("opens on the hub — one pane, chrome hidden, header 'Creator', mode 'Cash'", () => {
    const host = mount();
    log(`hub: visiblePanes=${JSON.stringify(onPanes(host))} count=${onPanes(host).length}`);
    expect(onPanes(host)).toEqual(["p0"]);
    expect(onPanes(host).length).toBe(1);
    expect(vis(q(host, "#bar"))).toBe(false);
    expect(vis(q(host, "#steps"))).toBe(false);
    expect(vis(q(host, "#ft"))).toBe(false);
    expect(vis(q(host, "#exit"))).toBe(false);
    expect(q(host, "#hdTitle")!.textContent).toBe("Creator");
    expect(q(host, "#cashtag")!.textContent!.trim()).toBe("Cash");
  });

  it("four tiles, in order; primary is Build a slate", () => {
    const host = mount();
    const titles = Array.from(host.querySelectorAll("#p0 .tile .n b")).map((b) => b.textContent);
    log(`tiles(${titles.length}): ${titles.join(" | ")}`);
    expect(titles).toEqual(["Read the rules", "How to become a creator", "Talk to Lockpick", "Practice mode"]);
    expect(q(host, "#goBuild")!.textContent!.trim()).toBe("Build a slate");
  });

  it("every tile opens its own view and returns to the hub; chrome stays hidden", () => {
    const host = mount();
    for (const [btn, pane, view] of [["#goRules", "pRules", "rules"], ["#goHow", "pHow", "how"], ["#goPick", "pPick", "lockpick"], ["#goPrac", "pPrac", "practice"]] as const) {
      click(q(host, btn));
      log(`  ${view}: panes=${JSON.stringify(onPanes(host))} chromeHidden=${!vis(q(host, "#bar")) && !vis(q(host, "#ft"))}`);
      expect(onPanes(host)).toEqual([pane]);
      expect(cb().view).toBe(view);
      expect(vis(q(host, "#bar"))).toBe(false);
      expect(vis(q(host, "#ft"))).toBe(false);
      click(host.querySelector(`#${pane} .crumb .home`));
      expect(onPanes(host)).toEqual(["p0"]);
      expect(cb().view).toBe("hub");
    }
  });

  it("rules screen carries the six archetypes and NEVER renders 'rake'", () => {
    const host = mount();
    click(q(host, "#goRules"));
    const rules = q(host, "#pRules")!.textContent!;
    for (const a of ["Cross-game head-to-head", "Field leader", "Split-squad duos", "Milestone count", "First to N", "Biggest night"]) {
      log(`  rules archetype present: ${a} = ${rules.includes(a)}`);
      expect(rules.includes(a)).toBe(true);
    }
    expect(/Who wins a game/.test(rules) && /spreads/.test(rules) && /over\/under/.test(rules)).toBe(true);
    expect(/two different games/.test(rules)).toBe(true);
    expect(/One pot per slate/.test(rules)).toBe(true);
    expect(/become fixed the moment it closes/.test(rules)).toBe(true);
    expect(/rake/i.test(rules)).toBe(false);
  });

  it("Lockpick: FAB hidden inside; asking appends Q + a fix-naming reply", async () => {
    const host = mount();
    click(q(host, "#goPick"));
    expect(vis(q(host, "#ls"))).toBe(false);
    const before = host.querySelectorAll("#thread .msg").length;
    click(host.querySelector('#askChips .chip[data-a="same"]'));
    const after = host.querySelectorAll("#thread .msg").length;
    log(`  lockpick thread ${before} → ${after}`);
    expect(after).toBe(before + 2);
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    const reply = host.querySelectorAll("#thread .msg.them");
    const last = reply[reply.length - 1]!.textContent || "";
    log(`  reply names the fix: "${last.slice(0, 54)}…"  Giannis=${/Giannis/.test(last)}`);
    expect(/Giannis/.test(last)).toBe(true);
    click(host.querySelector("#pPick .crumb .home"));
    expect(vis(q(host, "#ls"))).toBe(true);
  });

  it("Build a slate → step 1 with footer; step flow; invalid leg blocks step 3, fix unblocks", () => {
    const host = mount();
    click(q(host, "#goBuild"));
    log(`  build: panes=${JSON.stringify(onPanes(host))} step=${cb().step} footerVisible=${vis(q(host, "#ft"))} header="${q(host, "#hdTitle")!.textContent}"`);
    expect(onPanes(host)).toEqual(["p1"]);
    expect(cb().step).toBe(1);
    expect(vis(q(host, "#bar")) && vis(q(host, "#steps")) && vis(q(host, "#ft"))).toBe(true);
    expect(q(host, "#hdTitle")!.textContent).toBe("Build a slate");
    expect(q(host, "#next")!.textContent).toBe("Next: pick the night");
    click(q(host, "#next")); expect(cb().step).toBe(2); expect(onPanes(host)).toEqual(["p2"]);
    click(q(host, "#next")); expect(cb().step).toBe(3); expect(onPanes(host)).toEqual(["p3"]);
    const nBad = q(host, "#next") as HTMLButtonElement;
    log(`  step3 invalid: disabled=${nBad.disabled} label="${nBad.textContent}"`);
    expect(nBad.disabled).toBe(true);
    click(host.querySelector("#p3 #leg2 .flag")); // real click on the flag = fix the leg
    const nFixed = q(host, "#next") as HTMLButtonElement;
    log(`  step3 fixed:   disabled=${nFixed.disabled} label="${nFixed.textContent}"`);
    expect(nFixed.disabled).toBe(false);
    click(q(host, "#next")); expect(cb().step).toBe(4);
    click(q(host, "#next")); expect(cb().step).toBe(5); expect(onPanes(host)).toEqual(["p5"]);
    expect(!!host.querySelector("#p5 .preview .cta")).toBe(true);
    click(q(host, "#exit"));
    expect(onPanes(host)).toEqual(["p0"]);
    expect(cb().view).toBe("hub");
  });

  it("practice is a SEPARATE surface — its CTA never mounts a builder pane", () => {
    const host = mount();
    click(q(host, "#goPrac"));
    expect(/its own build/.test(q(host, "#pPrac")!.textContent!)).toBe(true);
    expect(/coin/i.test(q(host, "#pPrac")!.textContent!)).toBe(true);
    click(q(host, "#startPrac"));
    const builderPanes = onPanes(host).filter((id) => /^p[1-5]$/.test(id));
    log(`  after practice CTA: view=${cb().view} builderPanesMounted=${builderPanes.length} pushedTo=${JSON.stringify(pushMock.mock.calls.at(-1))}`);
    expect(cb().view).toBe("practice");
    expect(builderPanes.length).toBe(0); // NO builder mounted
    expect(pushMock).toHaveBeenCalledWith("/app/practice/create"); // §1d link-out
  });

  it("INVARIANT — exactly one pane + correct chrome in all six states", () => {
    const host = mount();
    const states: { name: string; enter: () => void; builder: boolean }[] = [
      { name: "hub", enter: () => click(host.querySelector("#pRules .crumb .home") ?? q(host, "#goBuild")), builder: false },
      { name: "rules", enter: () => click(q(host, "#goRules")), builder: false },
      { name: "how", enter: () => { click(host.querySelector(".pane.on .crumb .home") ?? q(host, "#exit")); click(q(host, "#goHow")); }, builder: false },
      { name: "lockpick", enter: () => { click(host.querySelector(".pane.on .crumb .home")); click(q(host, "#goPick")); }, builder: false },
      { name: "practice", enter: () => { click(host.querySelector(".pane.on .crumb .home")); click(q(host, "#goPrac")); }, builder: false },
      { name: "builder", enter: () => { click(host.querySelector(".pane.on .crumb .home")); click(q(host, "#goBuild")); }, builder: true },
    ];
    let violations = 0;
    for (const s of states) {
      s.enter();
      const panes = onPanes(host).length;
      const footer = vis(q(host, "#ft")), bar = vis(q(host, "#bar"));
      const okChrome = s.builder ? (footer && bar) : (!footer && !bar);
      if (panes !== 1 || !okChrome) violations++;
      log(`  [${s.name}] panes=${panes} footer=${footer} bar=${bar} → ${panes === 1 && okChrome ? "ok" : "VIOLATION"}`);
    }
    expect(violations).toBe(0);
  });
});
