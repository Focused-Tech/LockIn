/**
 * §4 GATE — STRUCTURAL comparison, not a presence checklist. Renders the approved mockup's Section A
 * (design/lockin_slate_card_mockup.html, sha256 a890d939…) and the live <SlateCard> with the SAME data,
 * then asserts their .slate element trees MATCH: same tags, same class names, same nesting, same order.
 * A "has a bezel / title is sans / stake at the bottom" checklist passed on a wrong-looking card — this
 * compares STRUCTURE so that can't happen again.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { SlateCard, type SlateLeg } from "./SlateCard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOCKUP_PATH = resolve(process.cwd(), "design/lockin_slate_card_mockup.html");
const EXPECTED_SHA = "a890d939e6cdc2635752d36e9458c640ef49dd57cc213cf632fda4c7009d8326";

/** Canonical signature of an element subtree: tag + sorted semantic class list + trimmed own-text.
 *  Ignores attributes/inline styles (the gate compares tags, CLASS NAMES, nesting, order — §4.1). */
function sig(el: Element, depth = 0): string {
  const classes = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean).sort();
  const ownText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => (n.textContent || "").trim())
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const head = `${"  ".repeat(depth)}${el.tagName.toLowerCase()}${classes.length ? "." + classes.join(".") : ""}${ownText ? ` "${ownText}"` : ""}`;
  const kids = Array.from(el.children).map((c) => sig(c, depth + 1));
  return [head, ...kids].join("\n");
}

/** Render the mockup's Section A card by executing its inline <script> in this jsdom document. */
function renderMockupSectionA(): Element {
  const html = readFileSync(MOCKUP_PATH, "utf8");
  const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
  document.body.innerHTML = '<div id="app"></div>';
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(script)();
  const slate = document.querySelector("#app .slate");
  if (!slate) throw new Error("mockup Section A .slate not found");
  return slate;
}

/** The exact Section A ("The approved card") data, as SlateCard props. */
const APPROVED_LEGS: SlateLeg[] = [
  { question: "Who has the bigger night?", state: "neutral", pickStyle: "contest", picks: [
    { label: "Luka", secondary: ["Lakers at Celtics", "32 a night · 41 last out"], selected: true },
    { label: "Jokić", secondary: ["Denver vs Phoenix", "26 · 12 · 9 on the season"] }] },
  { question: "Who leads the floor tonight?", qs: "Best line across all five games", state: "neutral", pickStyle: "contest", picks: [
    { label: "Luka", secondary: ["Lakers at Celtics", "32 a night"] },
    { label: "Giannis", secondary: ["Milwaukee at Miami", "31 a night"] },
    { label: "Curry", secondary: ["Golden State vs Sacramento", "28 a night"] },
    { label: "Booker", secondary: ["Denver vs Phoenix", "27 a night"] }] },
  { question: "How many of the five clear 30?", qs: "Call the shape of the night", state: "neutral", pickStyle: "chips", picks: [
    { label: "None or one" }, { label: "Two or three" }, { label: "Four or five" }] },
];

function renderLiveCard(): Element {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(h(SlateCard, {
      mode: "approved", currency: "coins", catColor: "#54B9FF",
      eyebrow: "QUILL · HAWK", title: "Tuesday Night Five", sub: "Five games · locks 7:10 pm",
      badge: "Coins · all 50 states",
      legs: APPROVED_LEGS,
      stakeMode: "always", stakeOptions: [100, 250, 500], selectedStake: 250, stakeLabel: "Play", stakeNote: "more = higher stakes",
      cta: { label: "Play · 250 coins", coin: true },
    }));
  });
  const slate = host.querySelector(".slate");
  if (!slate) throw new Error("live .slate not found");
  return slate;
}

describe("§4 SlateCard STRUCTURAL gate vs approved mockup Section A", () => {
  it("§3 (RULE 3) — the mockup file hash matches the approved copy", () => {
    const sha = createHash("sha256").update(readFileSync(MOCKUP_PATH)).digest("hex");
    // eslint-disable-next-line no-console
    console.log(`mockup sha256 = ${sha}`);
    expect(sha).toBe(EXPECTED_SHA);
  });

  it("§4.1 — element trees MATCH (same tags, class names, nesting, order); diff is empty", () => {
    const mock = sig(renderMockupSectionA());
    const live = sig(renderLiveCard());
    if (mock !== live) {
      const a = mock.split("\n"), b = live.split("\n");
      const diff: string[] = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(`  mock: ${a[i] ?? "∅"}\n  live: ${b[i] ?? "∅"}`);
      // eslint-disable-next-line no-console
      console.log("§4.1 TREE DIFF (must be empty):\n" + diff.join("\n"));
    } else {
      // eslint-disable-next-line no-console
      console.log("§4.1 TREE DIFF: (empty)\n" + live);
    }
    expect(live).toBe(mock);
  });

  it("§4.2 — a two-pick contest leg is .picks.contest.c2 (grid-template-columns 1fr 1fr)", () => {
    const slate = renderLiveCard();
    const picks = slate.querySelectorAll(".leg")[0]!.querySelector(".picks")!;
    const cls = picks.getAttribute("class");
    const css = readFileSync(resolve(process.cwd(), "src/components/slate/slate-card.css"), "utf8");
    const rule = /\.picks\.contest\.c2\{grid-template-columns:([^}]+)\}/.exec(css.replace(/\.lockin-slatecard /g, ""));
    // eslint-disable-next-line no-console
    console.log(`§4.2 two-pick class="${cls}" → grid-template-columns: ${rule?.[1]}`);
    expect(cls).toContain("contest");
    expect(cls).toContain("c2");
    expect(rule?.[1]).toBe("1fr 1fr");
  });

  it("§4.3 — a four-pick contest leg lays out 2×2 (c2 grid, 4 picks → two rows of two)", () => {
    const slate = renderLiveCard();
    const picks = slate.querySelectorAll(".leg")[1]!.querySelector(".picks")!;
    const n = picks.querySelectorAll(".pick").length;
    const positions = Array.from({ length: n }, (_, i) => ({ i, col: i % 2, row: Math.floor(i / 2) }));
    // eslint-disable-next-line no-console
    console.log(`§4.3 four-pick class="${picks.getAttribute("class")}" → ${JSON.stringify(positions)}`);
    expect(picks.getAttribute("class")).toContain("c2");
    expect(n).toBe(4);
    expect(positions).toEqual([{ i: 0, col: 0, row: 0 }, { i: 1, col: 1, row: 0 }, { i: 2, col: 0, row: 1 }, { i: 3, col: 1, row: 1 }]);
  });

  it("§4.4 — a pick has ONE .nm and N separate .cx lines (not one joined string)", () => {
    const slate = renderLiveCard();
    const firstPick = slate.querySelector(".leg .pick")!;
    const nms = firstPick.querySelectorAll(".nm");
    const cxs = Array.from(firstPick.querySelectorAll(".cx")).map((c) => c.textContent);
    // eslint-disable-next-line no-console
    console.log(`§4.4 .nm count=${nms.length} text="${nms[0]?.textContent}" | .cx=${JSON.stringify(cxs)}`);
    expect(nms.length).toBe(1);
    expect(nms[0]!.textContent).toBe("Luka");
    expect(cxs).toEqual(["Lakers at Celtics", "32 a night · 41 last out"]);
  });

  it("§4.5 — .stake and .cta are the last two flow children (lockfx overlay excepted)", () => {
    const slate = renderLiveCard();
    const flow = Array.from(slate.children).filter((c) => !c.classList.contains("lockfx"));
    const lastTwo = flow.slice(-2).map((c) => c.className);
    // eslint-disable-next-line no-console
    console.log(`§4.5 last two flow children = ${JSON.stringify(lastTwo)} (of ${flow.length}; lockfx present=${!!slate.querySelector(".lockfx")})`);
    expect(flow[flow.length - 2]!.classList.contains("stake")).toBe(true);
    expect(flow[flow.length - 1]!.classList.contains("cta")).toBe(true);
  });

  it("§4.6 — the card's border-color equals the category token (the bezel)", () => {
    const slate = renderLiveCard() as HTMLElement;
    const cat = slate.style.getPropertyValue("--cat").trim();
    // border is `2px solid var(--cat)` in CSS; assert --cat is the category color we passed.
    // eslint-disable-next-line no-console
    console.log(`§4.6 --cat (bezel color) = ${cat}`);
    expect(cat).toBe("#54B9FF");
  });
});

// ── Behaviour coverage (ported from the retired SLICE-3.4 presence gate, re-expressed on the mockup
//    structure): no render errors, Fox Pit face, afterAnswers gating, lock overlay, real clicks. ──
const errs: unknown[] = [];
window.addEventListener("error", (e) => errs.push((e as ErrorEvent).error ?? (e as ErrorEvent).message));
window.addEventListener("unhandledrejection", (e) => errs.push((e as PromiseRejectionEvent).reason));

function render(props: Parameters<typeof SlateCard>[0]): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host).render(h(SlateCard, props)));
  return host;
}

describe("SlateCard behaviour", () => {
  it("renders every mode without errors; keydrop is NEVER on the card; bezel = --cat", () => {
    for (const mode of ["foxpit", "beginner", "advanced", "practice", "creator"]) {
      errs.length = 0;
      const el = render({ mode, currency: "cash", catColor: "#54B9FF", title: "T", legs: APPROVED_LEGS,
        stakeMode: "always", stakeOptions: [5, 10, 25], selectedStake: 10, cta: { label: "Lock in" } });
      expect(errs).toEqual([]);
      expect(el.textContent).not.toContain("keydrop");
      expect((el.querySelector(".slate") as HTMLElement).style.getPropertyValue("--cat").trim()).toBe("#54B9FF");
      expect(el.querySelector(".stake")!.textContent).toContain("$5"); // cash-correct chips
    }
  });

  it("Fox Pit face variant renders the baked image + overlaid title, bezel preserved", () => {
    const el = render({ mode: "foxpit", currency: "coins", catColor: "#54B9FF", faceImage: "/foxpit/cards/card_front_single.png", title: "Slate 1 · halftime shows", legs: [], stakeMode: "none" });
    expect(errs).toEqual([]);
    expect((el.querySelector("[data-face-image]") as HTMLImageElement).getAttribute("src")).toBe("/foxpit/cards/card_front_single.png");
    expect(el.querySelector(".title")!.textContent).toBe("Slate 1 · halftime shows");
  });

  it("afterAnswers stake is GATED until answered → .hint shown, no .stake chips", () => {
    const gated = render({ mode: "advanced", currency: "cash", catColor: "#54B9FF", legs: APPROVED_LEGS, stakeMode: "afterAnswers", stakeOptions: [5, 10, 25], answered: false });
    expect(gated.querySelector(".hint")).toBeTruthy();
    expect(gated.querySelector(".stake")).toBeNull();
    const open = render({ mode: "advanced", currency: "cash", catColor: "#54B9FF", legs: APPROVED_LEGS, stakeMode: "afterAnswers", stakeOptions: [5, 10, 25], answered: true });
    expect(open.querySelector(".stake")).toBeTruthy();
    expect(open.querySelector(".hint")).toBeNull();
  });

  it("disabled CTA + lock overlay (.lockfx always in DOM)", () => {
    const el = render({ mode: "advanced", currency: "cash", catColor: "#54B9FF", legs: APPROVED_LEGS, cta: { label: "Lock in", disabled: true }, locking: true });
    expect((el.querySelector(".cta") as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector(".lockfx")).toBeTruthy();
    expect(el.querySelector(".slate")!.classList.contains("locking")).toBe(true);
  });

  it("dispatches real clicks on a pick and the CTA", () => {
    const onPick = vi.fn(), onCta = vi.fn();
    const el = render({ mode: "advanced", currency: "cash", catColor: "#54B9FF", legs: APPROVED_LEGS, cta: { label: "Play" }, onPick, onCta });
    act(() => { (el.querySelector(".pick") as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    act(() => { (el.querySelector(".cta") as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onPick).toHaveBeenCalledWith(0, 0);
    expect(onCta).toHaveBeenCalled();
  });
});
