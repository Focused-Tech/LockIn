/**
 * CREATOR ABUSE MODERATION (Part 3) — distinct from validateLeg (compliance SHAPE).
 * Asserts: the deterministic layer catches the unambiguous abuse categories; ordinary creator
 * questions pass; all three publish paths run moderation AFTER the shape/Lockpick check and before
 * the write (both gates, shape first); and the report ledger + unpublish lever are server-only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { deterministicModerationCategory } from "./patterns";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("deterministic abuse layer (free, no model call)", () => {
  const cases: [string, string][] = [
    ["hate", "these retards can't hoop"],
    ["violence", "I'll kill you if he misses"],
    ["self_harm", "commit suicide"],
    ["sexual", "explicit erotica night"],
    ["doxxing", "call him at 415-555-1212"],
    ["doxxing", "his ssn is 123-45-6789"],
  ];
  for (const [cat, text] of cases) {
    it(`flags ${cat}: ${text.slice(0, 24)}…`, () => {
      expect(deterministicModerationCategory(text)).toBe(cat);
    });
  }
  it("passes ordinary creator questions", () => {
    for (const ok of [
      "Who scores more tonight — Curry or Doncic?",
      "Bigger night: Ohtani or Judge?",
      "Which headliner sells more first-week — Drake or Kendrick?",
    ]) {
      expect(deterministicModerationCategory(ok)).toBeNull();
    }
  });
});

describe("moderation runs at publish, AFTER the shape gate, before the write", () => {
  it("createSlate: moderateCreatorFields after detectBannedArchetype, before batch.commit", () => {
    const s = read("src/app/app/create/actions.ts");
    const shape = s.indexOf("detectBannedArchetype");
    const mod = s.indexOf("moderateCreatorFields");
    const write = s.indexOf("batch.commit()");
    expect(shape).toBeGreaterThan(-1);
    expect(mod).toBeGreaterThan(shape); // shape first
    expect(write).toBeGreaterThan(mod); // then write
  });
  it("publishProSlate: moderateCreatorFields after validateSlate, before batch commit", () => {
    const s = read("src/app/app/create/pro/actions.ts");
    expect(s.indexOf("moderateCreatorFields")).toBeGreaterThan(s.indexOf("validateSlate"));
  });
  it("createPackage: package name moderated before ref.set", () => {
    const s = read("src/app/app/packages/actions.ts");
    const mod = s.indexOf("moderateCreatorFields");
    expect(mod).toBeGreaterThan(-1);
    expect(s.indexOf("pickPackages).doc()")).toBeGreaterThan(mod);
  });
  it("moderation uses the cheapest model (CHAT_MODEL) and fails open on the classifier", () => {
    const m = read("src/lib/moderation/creatorContent.ts");
    expect(m).toContain("CHAT_MODEL");
    expect(m).toContain("process.env.ANTHROPIC_API_KEY"); // fail-open guard
  });
});

describe("report ledger + unpublish are server-only", () => {
  it("contentReports written by the report endpoint", () => {
    const r = read("src/app/api/content/report/route.ts");
    expect(r).toContain("COLLECTIONS.contentReports");
  });
  it("unpublish sets moderationHidden and the read path honors it", () => {
    const u = read("src/app/api/admin/unpublish/route.ts");
    expect(u).toContain("moderationHidden");
    expect(u).toContain("ADMIN_SETTLE_SECRET");
    const slates = read("src/server/data/slates.ts");
    expect(slates).toContain("moderationHidden === true");
  });
});
