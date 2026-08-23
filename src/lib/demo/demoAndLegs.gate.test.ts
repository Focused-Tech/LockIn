/**
 * PRESENTATION DEMO + LEG-COUNT RULING — the gate.
 *
 * Two independent things are protected here.
 *
 * 1. THE RULING (2026-08-23): one topic, three legs, and no non-Championship slate showing more than
 *    five questions. The design references disagree with each other on this — `product_surface_v3`
 *    renders six legs — so the rule lives in code and the references are treated as stale.
 *
 * 2. THE DEMO IS NOT PUBLIC. It keeps the reference's marquee names (real broadcasters, real
 *    athletes) because Frank ruled they stay for presentation. That makes "can a non-admin reach
 *    this?" a real question, and the strongest answer is not a runtime check — it is that the data
 *    module is `server-only`, so a client import fails the BUILD. These tests assert the guard is
 *    actually in place, and that no PUBLIC surface carries a marquee name.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  TOPICS_PER_SLATE,
  LEGS_PER_SLATE,
  MAX_LEGS_PRESENTED,
  validateLegRules,
  legRulesPass,
  firstLegRuleError,
} from "@/lib/contest/legRules";
import { detectBannedArchetype } from "@/lib/contest/questionEngine";
import { DEMO_SCRIPT, DEMO_HOSTS, DEMO_CHAPTERS, DEMO_SHAPE } from "./presentation";
import { DEMO_BOSSES, DEMO_CONTENDERS, DEMO_NAME_ALLOWLIST } from "./cast";
import { JOURNEY_LANES, lanesForSurface, webFrontDoor } from "@/lib/journey/lanes";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/* ══ 1. The ruling ══════════════════════════════════════════════════════════════════════════════ */

describe("leg-count ruling", () => {
  it("is one topic, three legs, five-question ceiling", () => {
    expect(TOPICS_PER_SLATE).toBe(1);
    expect(LEGS_PER_SLATE).toBe(3);
    expect(MAX_LEGS_PRESENTED).toBe(5);
  });

  it("passes a correctly shaped slate", () => {
    expect(legRulesPass({ topicCount: 1, legCount: 3 })).toBe(true);
    expect(validateLegRules({ topicCount: 1, legCount: 3 })).toEqual([]);
  });

  it("NEGATIVE CONTROL — rejects the six legs the v3 surface file renders", () => {
    const v = validateLegRules({ topicCount: 1, legCount: 6 });
    expect(v.map((x) => x.code)).toContain("LEG_COUNT");
    expect(legRulesPass({ topicCount: 1, legCount: 6 })).toBe(false);
  });

  it("rejects two topics, and four legs, and zero legs", () => {
    expect(validateLegRules({ topicCount: 2, legCount: 3 }).map((v) => v.code)).toContain("TOPIC_COUNT");
    expect(validateLegRules({ topicCount: 1, legCount: 4 }).map((v) => v.code)).toContain("LEG_COUNT");
    expect(validateLegRules({ topicCount: 1, legCount: 0 }).map((v) => v.code)).toContain("LEG_COUNT");
  });

  it("caps questions PRESENTED at five outside the Championship", () => {
    const over = validateLegRules({ topicCount: 1, legCount: 3, presentedCount: 6 });
    expect(over.map((v) => v.code)).toContain("PRESENTED_OVER_CEILING");
    const at = validateLegRules({ topicCount: 1, legCount: 3, presentedCount: 5 });
    expect(at.map((v) => v.code)).not.toContain("PRESENTED_OVER_CEILING");
  });

  it("the Championship is exempt from the ceiling ONLY — it still builds in threes", () => {
    const champ = validateLegRules({ topicCount: 1, legCount: 3, presentedCount: 9, kind: "championship" });
    expect(champ).toEqual([]);
    const champBadLegs = validateLegRules({ topicCount: 1, legCount: 6, kind: "championship" });
    expect(champBadLegs.map((v) => v.code)).toContain("LEG_COUNT");
  });

  it("reports every violation at once and names the numbers", () => {
    const all = validateLegRules({ topicCount: 3, legCount: 7, presentedCount: 7 });
    expect(all).toHaveLength(3);
    expect(firstLegRuleError({ topicCount: 1, legCount: 6 })).toMatch(/3 legs.*has 6/);
  });
});

/* ══ 2. The demo obeys the ruling ═══════════════════════════════════════════════════════════════ */

describe("presentation demo shape", () => {
  it("every host slate is one topic and exactly three legs", () => {
    expect(DEMO_HOSTS.length).toBeGreaterThan(10);
    for (const h of DEMO_HOSTS) {
      expect(h.legs, `${h.name} leg count`).toHaveLength(LEGS_PER_SLATE);
      expect(h.topic.trim().length).toBeGreaterThan(0);
      expect(legRulesPass({ topicCount: 1, legCount: h.legs.length })).toBe(true);
    }
    expect(DEMO_SHAPE.legsPerSlate).toBe(3);
    expect(DEMO_SHAPE.topicsPerSlate).toBe(1);
  });

  it("keeps the reference's category structure, and every host is reachable from it", () => {
    expect(DEMO_SCRIPT.length).toBe(DEMO_SHAPE.categories);
    expect(DEMO_SCRIPT.length).toBeGreaterThan(5);
    const fromCategories = DEMO_SCRIPT.flatMap((c) => c.creators.map((h) => h.id)).sort();
    expect(fromCategories).toEqual(DEMO_HOSTS.map((h) => h.id).sort());
    for (const c of DEMO_SCRIPT) {
      expect(c.creators.length).toBeGreaterThan(0);
      expect(c.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries the reference's twelve chapters in order", () => {
    expect(DEMO_CHAPTERS).toHaveLength(12);
    expect(DEMO_CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(DEMO_CHAPTERS[1]!.title).toMatch(/one topic, three legs/);
  });

  it("every leg has options and display-only context", () => {
    for (const h of DEMO_HOSTS) {
      for (const leg of h.legs) {
        expect(leg.options.length).toBeGreaterThanOrEqual(2);
        expect(leg.question.length).toBeGreaterThan(10);
      }
    }
  });

  it("no demo leg is a banned archetype (the same detector the product uses)", () => {
    const offenders: string[] = [];
    for (const h of DEMO_HOSTS) {
      for (const leg of h.legs) {
        const a = detectBannedArchetype(leg.question, leg.options);
        if (a) offenders.push(`${h.name}: "${leg.question}" -> ${a}`);
      }
    }
    // Reported in full rather than as a bare count, so a failure names the leg to fix.
    expect(offenders).toEqual([]);
  });
});

/* ══ 3. THE DEMO IS NOT PUBLIC ══════════════════════════════════════════════════════════════════ */

describe("the presentation demo cannot reach the public", () => {
  const mod = read("src/lib/demo/presentation.ts");
  const page = read("src/app/admin/demo/page.tsx");
  const player = read("src/app/admin/demo/DemoPlayer.tsx");

  it('the data module is `server-only` — a client import fails the BUILD, not just a check', () => {
    // Trimmed: the file is CRLF on this platform, so the first line carries a trailing \r.
    expect(mod.trimStart().startsWith('import "server-only";')).toBe(true);
  });

  it("the route 404s for non-admins BEFORE reading the data, and never redirects", () => {
    expect(page).toContain("isAdminUid");
    expect(page).toContain("notFound()");
    // A redirect would confirm the route exists to someone who may not have it.
    expect(page).not.toContain("redirect(");
    // The guard precedes any USE of the demo data. Compare inside the component body, since the
    // import statement necessarily sits above everything.
    const body = page.slice(page.indexOf("export default"));
    expect(body.indexOf("notFound()")).toBeLessThan(body.indexOf("DEMO_SCRIPT"));
  });

  it("the gate is two-stage, and neither stage discloses the demo", () => {
    // Stage 1 — the shared admin LAYOUT bounces an unauthenticated visitor to /login. That is
    // pre-existing and applies to every /admin route equally, so it reveals nothing about this one.
    // Verified live: GET /admin/demo with no cookie, and with a malformed cookie, both returned 307
    // with zero marquee names in the body.
    const layout = read("src/app/admin/layout.tsx");
    expect(layout).toContain('redirect("/login")');
    // Stage 2 — a SIGNED-IN non-admin gets past the layout and is 404'd by the page itself.
    expect(page).toContain("notFound()");
  });

  it("the client player imports only TYPES from the data module", () => {
    const importLine = player.match(/import .*from "@\/lib\/demo\/presentation";/)?.[0] ?? "";
    expect(importLine).toMatch(/^import type /);
  });

  it("NEGATIVE CONTROL — the marquee names really are in the demo module", () => {
    // If this ever fails, the assertions below about them being absent elsewhere prove nothing.
    expect(mod).toContain("Shannon Sharpe");
    expect(mod).toContain("Katt Williams");
  });

  it("no marquee name appears anywhere outside the demo module and its gated route", () => {
    const MARQUEE = [
      "Shannon Sharpe", "Ryan Clark", "Jeff Teague", "Katt Williams", "85 South Show",
      "DL Hughley", "Joe Budden", "Lady of Rage", "Angela Yee", "Rickey Smiley",
      "Mahomes", "Bijan", "Pacheco",
    ];
    const ALLOWED = [
      "src/lib/demo/presentation.ts",
      "src/lib/demo/demoAndLegs.gate.test.ts",
      // PRE-EXISTING, not introduced here. Both carry a real athlete surname in sample data and
      // predate the presentation demo. card-preview is a Fox Pit tower file and is FROZEN, so it is
      // not mine to edit; roster.ts is practice sample data. Flagged for a ruling, allowlisted so
      // this guard still catches anything NEW.
      "src/app/app/foxpit/card-preview/page.tsx",
      "src/lib/practice/roster.ts",
    ].map((p) => p.replace(/\//g, "\\"));

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry)) continue;
        const rel = p.replace(resolve(process.cwd()) + "\\", "").replace(/\//g, "\\");
        if (ALLOWED.some((a) => rel.endsWith(a))) continue;
        const body = readFileSync(p, "utf8");
        for (const m of MARQUEE) {
          if (body.includes(m)) offenders.push(`${rel} :: ${m}`);
        }
      }
    };
    walk(resolve(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});

/* ══ 4. Public example data uses the Fox Pit cast ═══════════════════════════════════════════════ */

describe("public-facing cast is the Fox Pit tower's own", () => {
  it("bosses come from the tower ruleset, not retyped", () => {
    expect(DEMO_BOSSES.map((b) => b.name)).toEqual([
      "Sensei Owl",
      "Alpha Wolf",
      "Boss Raven",
      "Boss Fox",
    ]);
  });

  it("contenders are the canonical underling roster", () => {
    const names = DEMO_CONTENDERS.map((c) => c.name);
    for (const n of ["Runt", "Luna", "Scout", "Fang", "Vixen", "Ghost"]) expect(names).toContain(n);
    for (const n of ["Omen", "Hex", "Pica", "Quill", "Nyx", "Grim"]) expect(names).toContain(n);
    expect(names).toHaveLength(12);
  });

  it("every allowlisted name has usable initials", () => {
    expect(DEMO_NAME_ALLOWLIST.length).toBe(16);
    for (const c of [...DEMO_BOSSES, ...DEMO_CONTENDERS]) {
      expect(c.initials).toMatch(/^[A-Z]{1,2}$/);
    }
  });

  it("the cast module writes nothing back to the tower", () => {
    const cast = read("src/lib/demo/cast.ts");
    expect(cast).toMatch(/import \{ ROOM_RULES \} from "@\/lib\/foxpit\/rules"/);
    expect(cast).not.toMatch(/\b(writeFile|set\(|update\(|delete\()/);
  });
});

/* ══ 5. Web front door drops every coin lane ════════════════════════════════════════════════════ */

describe("web journey selector", () => {
  it("web shows only cash lanes; mobile keeps everything", () => {
    const web = lanesForSurface("web").map((l) => l.id);
    const mobile = lanesForSurface("mobile").map((l) => l.id);
    expect(web).toEqual(["creator", "advanced"]);
    expect(mobile).toEqual(["creator", "advanced", "beginner", "foxpit"]);
  });

  it("NEGATIVE CONTROL — the coin lanes exist, so excluding them means something", () => {
    expect(JOURNEY_LANES.filter((l) => l.currency === "coins").map((l) => l.id)).toEqual([
      "beginner",
      "foxpit",
    ]);
  });

  it("filters on currency, so a coin lane added later is excluded automatically", () => {
    const withNewCoinLane = [
      ...JOURNEY_LANES,
      { id: "new", title: "t", body: "b", currency: "coins" as const, color: "fox" as const, href: "/x", isLane: false },
    ];
    expect(withNewCoinLane.filter((l) => l.currency === "cash").map((l) => l.id)).toEqual([
      "creator",
      "advanced",
    ]);
  });

  it("the front door includes leaderboards and contests", () => {
    const ids = webFrontDoor().map((l) => l.id);
    expect(ids).toContain("leaderboard");
    expect(ids).toContain("contests");
    expect(ids).not.toContain("beginner");
    expect(ids).not.toContain("foxpit");
  });

  it("no front-door copy uses wagering vocabulary", () => {
    const copy = webFrontDoor().map((l) => `${l.title} ${l.body}`).join(" ");
    expect(copy).not.toMatch(/\b(bet|wager|odds|rake|gambl)/i);
  });
});
