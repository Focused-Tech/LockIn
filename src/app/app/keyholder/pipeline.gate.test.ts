/**
 * PIPELINE PORTAL (Parts 4–5) contracts:
 *   · My Key = two links off the SAME code (player vs creator landing) + a QR of the invite + share;
 *   · My Creators renders pipeline STAGES with time-stuck and "—" where a stage's data is absent;
 *   · My Earnings is projected-only, grouped by band, "—" while rates unset; no payout control;
 *   · the keymaster drill-in is limited to the caller's OWN downline.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const portal = read("src/app/app/keyholder/KeyholderPortal.tsx");
const pipeline = read("src/server/data/keyholderPipeline.ts");
const drill = read("src/app/app/keymaster/[uid]/page.tsx");

describe("My Key — two links off one code + QR + share", () => {
  it("both invite links carry the SAME code; only the destination differs", () => {
    expect(portal).toContain("/signup?ref=${encodeURIComponent(code)}`");
    expect(portal).toContain("/signup?ref=${encodeURIComponent(code)}&as=creator`");
    expect(portal).toContain("QRCode.toDataURL(playerLink");
    expect(portal).toContain("nav.share");
  });
});

describe("My Creators — pipeline stages, time-stuck, and '—' for absent data", () => {
  it("stages are derived and stuck/participation render '—' when null", () => {
    expect(pipeline).toContain('"invited"');
    expect(pipeline).toContain('"signed_up"');
    expect(pipeline).toContain('"participating"');
    // agreement stage has no timestamp on the profile → stuckMs null → "—"
    expect(pipeline).toContain('stage = "agreement";\n        stuckMs = null;');
    expect(portal).toContain('if (ms == null) return "—"'); // stuckLabel
    expect(portal).toContain('return p == null ? "—"'); // pctLabel
  });
});

describe("My Earnings — projected only, by band; no payout", () => {
  it("dollars are '—' by band and there is no payout control", () => {
    expect(portal).toContain('b.projectedCents == null ? "—"');
    expect(portal).toContain("PROJECTED — rates pending final approval");
    expect(portal.includes("Payout")).toBe(false);
    expect(/withdraw|cash out/i.test(portal)).toBe(false);
  });
});

describe("keymaster drill-in — own downline only, read-only banner", () => {
  it("404s unless the target is in the caller's tree; carries a banner", () => {
    expect(drill).toContain("if (!me.keymaster) notFound()");
    expect(drill).toContain("target.keymasterUid !== me.id) notFound()");
    expect(drill).toContain("bannerName={target.username}");
    expect(drill).toContain("hideHeader");
  });
});
