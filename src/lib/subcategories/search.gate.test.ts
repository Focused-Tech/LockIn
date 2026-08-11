/**
 * GATE (B) — subcategory search is DATA-driven, ranks sensibly, and NEVER dead-ends: an unknown show
 * synthesizes a usable entertainment subcategory. No hardcoded show names live in components — every
 * name comes from the seed/Firestore index this searches.
 */
import { describe, it, expect } from "vitest";
import { SUBCATEGORY_SEED } from "./seed";
import { searchSubcategories, synthesizeSubcategory, hasMatch } from "./search";

const log = (m: string) => console.log(m); // eslint-disable-line no-console

describe("subcategory search", () => {
  it("finds reality shows by name, nickname, and franchise word", () => {
    for (const [q, expected] of [
      ["basketball wives", "Basketball Wives"],
      ["bbw", "Basketball Wives"],
      ["rhoa", "The Real Housewives of Atlanta"],
      ["top chef", "Top Chef"],
      ["blind auditions", "The Voice"], // alias resolves the show
      ["bake off", "The Great British Baking Show"],
    ] as const) {
      const top = searchSubcategories(q, SUBCATEGORY_SEED)[0];
      log(`search "${q}" → ${top?.name}`);
      expect(top?.name).toBe(expected);
    }
  });

  it("finds sports leagues and carries the ESPN league + sports domain", () => {
    const nba = searchSubcategories("nba", SUBCATEGORY_SEED)[0]!;
    expect(nba.name).toBe("NBA");
    expect(nba.domain).toBe("sports");
    expect(nba.subjectSource).toBe("espn_roster");
    expect(nba.espnLeague).toBe("nba");
    expect(nba.stats.map((s) => s.stat)).toContain("assists");
  });

  it("reality shows are entertainment + creator_cast (no cast API), with noun stats and no numbers", () => {
    const bw = searchSubcategories("basketball wives", SUBCATEGORY_SEED)[0]!;
    expect(bw.domain).toBe("entertainment");
    expect(bw.subjectSource).toBe("creator_cast");
    expect(bw.stats.every((s) => s.milestone === undefined && s.race === undefined)).toBe(true);
    log(`Basketball Wives stats: ${bw.stats.map((s) => s.stat).join(", ")}`);
  });

  it("does NOT dead-end: an unindexed show synthesizes a usable entertainment subcategory", () => {
    const q = "Selling The OC Mansion Wars";
    expect(hasMatch(q, SUBCATEGORY_SEED)).toBe(false);
    const syn = synthesizeSubcategory(q);
    log(`synthesized "${q}" → slug=${syn.slug} domain=${syn.domain} source=${syn.source}`);
    expect(syn.name).toBe(q);
    expect(syn.domain).toBe("entertainment");
    expect(syn.subjectSource).toBe("creator_cast");
    expect(syn.stats.length).toBeGreaterThan(0);
    expect(syn.source).toBe("custom");
  });

  it("empty query returns the head of the index (leagues first)", () => {
    const head = searchSubcategories("", SUBCATEGORY_SEED, 3);
    expect(head.length).toBe(3);
    expect(head[0]!.kind).toBe("sports_league");
  });

  it("the seed index has no duplicate slugs", () => {
    const slugs = SUBCATEGORY_SEED.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    log(`seed index size: ${SUBCATEGORY_SEED.length} (${SUBCATEGORY_SEED.filter((s) => s.domain === "entertainment").length} entertainment)`);
  });
});
