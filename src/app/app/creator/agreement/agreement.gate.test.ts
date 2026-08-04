/**
 * §9 GATE — creator acknowledgment flow. Drives the real component with dispatched events
 * and exercises the route gate. Prints numbers, does not assert booleans blind.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { AGREEMENT_VERSION, SECTION_KEYS, isCreatorOnboarded, type SectionKey } from "@/lib/creator/agreement";
import { AgreementFlow } from "./AgreementFlow";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock the server action: an in-memory signature store that mirrors the real one.
const store = vi.hoisted(() => ({ signed: [] as string[] }));
vi.mock("./actions", () => ({
  signCreatorSection: async (section: string) => {
    if (!store.signed.includes(section)) store.signed.push(section);
    const onboarded = ["content", "contest", "payout"].every((k) => store.signed.includes(k));
    return { ok: true, signed: [...store.signed], onboarded };
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (r: string) => ((store as unknown as { pushed?: string }).pushed = r) }) }));

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

function mount(initialSigned: SectionKey[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(h(AgreementFlow, { initialSigned })));
  return { host, root };
}
const q = (host: Element, s: string) => host.querySelector(s) as HTMLElement | null;
const clickA = async (el: Element | null) => { await act(async () => { el?.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };

beforeEach(() => { store.signed = []; document.body.innerHTML = ""; });

describe("§9 route gate — the check is at the route, keyed on the current version", () => {
  it("incomplete/old-version records are NOT onboarded; a full current-version record is", () => {
    expect(isCreatorOnboarded({ creatorOnboarded: false, creatorAgreementVersion: undefined })).toBe(false);
    expect(isCreatorOnboarded({ creatorOnboarded: true, creatorAgreementVersion: "v0.9" })).toBe(false); // version bump → re-sign
    expect(isCreatorOnboarded({ creatorOnboarded: true, creatorAgreementVersion: AGREEMENT_VERSION })).toBe(true);
    console.log(`§9 gate: onboarded requires creatorOnboarded && version===${AGREEMENT_VERSION}. old v0.9 → re-sign.`);
  });
  it("v1 /app/create is retired to the v2 hub; the hub route gates onboarding; the flow bounces an onboarded creator to the hub", () => {
    const CREATE = read("src/app/app/create/page.tsx");
    const HUB = read("src/app/app/creator/page.tsx");
    const FLOW = read("src/app/app/creator/agreement/page.tsx");
    // version one is retired — /app/create only redirects to the v2 hub, never renders SlateBuilder
    expect(CREATE.includes('redirect("/app/creator")')).toBe(true);
    expect(/import[^\n]*SlateBuilder|<SlateBuilder/.test(CREATE)).toBe(false); // not rendered (comment mention is fine)
    // the agreement gate now lives on the v2 hub route (deep-link-proof)
    expect(HUB.includes('if (!isCreatorOnboarded(profile)) redirect("/app/creator/agreement")')).toBe(true);
    expect(FLOW.includes('if (isCreatorOnboarded(profile)) redirect("/app/creator")')).toBe(true);
    console.log("§9 /app/create → /app/creator (v1 retired); hub → (incomplete) → agreement ; flow → (onboarded) → hub");
  });
});

describe("§9 flow — drive it", () => {
  it("Continue disabled on load; pressing it unsigned does nothing; signing enables it; section 2 loads UNSIGNED", async () => {
    const { host } = mount([]);
    const next = q(host, "[data-ack-next]") as HTMLButtonElement;
    console.log(`§9 load: count=${q(host, "[data-ack-count]")!.textContent} next.disabled=${next.disabled}`);
    expect(next.disabled).toBe(true);

    const before = q(host, "[data-ack-count]")!.textContent;
    await clickA(next); // unsigned → no-op
    const after = q(host, "[data-ack-count]")!.textContent;
    console.log(`§9 unsigned Continue: step ${before} → ${after} (unchanged)`);
    expect(after).toBe(before);

    await clickA(q(host, "[data-ack-sign]")); // tick section 1
    console.log(`§9 signed section 1: next.disabled=${next.disabled}`);
    expect(next.disabled).toBe(false);

    await clickA(next); // advance to section 2
    const sec2Count = q(host, "[data-ack-count]")!.textContent;
    const sign2On = q(host, "[data-ack-sign]")!.classList.contains("on");
    console.log(`§9 section 2: count=${sec2Count} sign.on=${sign2On} next.disabled=${(q(host, "[data-ack-next]") as HTMLButtonElement).disabled}`);
    expect(sec2Count).toBe("2 of 3");
    expect(sign2On).toBe(false); // the tick did NOT carry forward
  });

  it("all three signed → done screen writes THREE signature records", async () => {
    const { host } = mount([]);
    for (let s = 0; s < 3; s++) {
      await clickA(q(host, "[data-ack-sign]"));
      await clickA(q(host, "[data-ack-next]"));
    }
    const recs = Array.from(host.querySelectorAll("[data-ack-rec]")).map((r) => ({
      section: r.getAttribute("data-ack-rec"),
      text: (r.textContent || "").replace(/\s+/g, " ").trim(),
    }));
    console.log(`§9 done: store.signed=${JSON.stringify(store.signed)} · records:\n` + recs.map((r) => `   ${r.section}: ${r.text}`).join("\n"));
    expect(store.signed.sort()).toEqual([...SECTION_KEYS].sort());
    expect(recs.length).toBe(3);
    expect(recs.every((r) => r.text.includes(AGREEMENT_VERSION))).toBe(true);
  });

  it("a creator with 2 of 3 signed re-enters and RESUMES at section 3", async () => {
    store.signed = ["content", "contest"];
    const { host } = mount(["content", "contest"]);
    const count = q(host, "[data-ack-count]")!.textContent;
    console.log(`§9 resume with 2/3 signed → step count=${count}`);
    expect(count).toBe("3 of 3");
    // and the two prior nodes are already filled (done)
    const doneNodes = Array.from(host.querySelectorAll("[data-ack-node].done")).length;
    console.log(`§9 resume: filled rail nodes = ${doneNodes}`);
    expect(doneNodes).toBe(2);
  });
});

describe("§9 chevron — no long arrows; chevrons are canonical", () => {
  it("the flow uses no long arrows (→); only the chevron family (‹ back / ›)", () => {
    const files = [
      "src/app/app/creator/agreement/AgreementFlow.tsx",
      "src/app/app/creator/agreement/page.tsx",
      "src/lib/creator/agreement.ts",
      "src/app/app/create/page.tsx",
    ];
    const longArrows = new Set<string>();
    const chevrons = new Set<string>();
    for (const f of files) {
      const src = read(f);
      for (const g of src.match(/[→➔➝⟶»]|&rarr;/g) || []) longArrows.add(g);
      for (const g of src.match(/[‹›]/g) || []) chevrons.add(g);
    }
    console.log(`§9 long-arrow set = { ${[...longArrows].join(" ")} } (must be empty) · chevron set = { ${[...chevrons].join(" ")} }`);
    expect([...longArrows]).toEqual([]);
  });
});
