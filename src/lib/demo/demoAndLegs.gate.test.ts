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
import { LANES, PUBLIC_LANES, ROLE_LANES, visibleLanes, hasAnyStaffRole } from "@/lib/journey/lanes";

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

/* ══ 5. /start — the six lanes and their gating ═════════════════════════════════════════════════ */

describe("/start lanes", () => {
  it("carries exactly the ruled six", () => {
    expect(LANES.map((l) => l.id)).toEqual([
      "creator",
      "advanced",
      "beginner",
      "admin",
      "keymaster",
      "keyholder",
    ]);
  });

  it("Fox Pit practice is NOT a lane here", () => {
    expect(LANES.map((l) => l.id)).not.toContain("foxpit");
  });

  it("an anonymous visitor sees the three public lanes and nothing else", () => {
    expect(visibleLanes(null).map((l) => l.id)).toEqual(["creator", "advanced", "beginner"]);
  });

  it("NEGATIVE CONTROL — the staff lanes exist, so their absence means something", () => {
    expect(ROLE_LANES.map((l) => l.id)).toEqual(["admin", "keymaster", "keyholder"]);
    expect(PUBLIC_LANES).toHaveLength(3);
  });

  it("a signed-in user with no staff flag still sees only the three", () => {
    expect(visibleLanes({}).map((l) => l.id)).toEqual(["creator", "advanced", "beginner"]);
    expect(
      visibleLanes({ admin: false, keymaster: false, keyholder: false }).map((l) => l.id),
    ).toEqual(["creator", "advanced", "beginner"]);
  });

  it("each staff flag adds exactly its own lane", () => {
    expect(visibleLanes({ admin: true }).map((l) => l.id)).toEqual([
      "creator", "advanced", "beginner", "admin",
    ]);
    expect(visibleLanes({ keyholder: true }).map((l) => l.id)).toEqual([
      "creator", "advanced", "beginner", "keyholder",
    ]);
  });

  it("roles are ADDITIVE — several flags show several lanes (matches the drawer)", () => {
    const all = visibleLanes({ admin: true, keymaster: true, keyholder: true });
    expect(all).toHaveLength(6);
    expect(hasAnyStaffRole({ keymaster: true })).toBe(true);
    expect(hasAnyStaffRole(null)).toBe(false);
    expect(hasAnyStaffRole({})).toBe(false);
  });

  it("every lane routes somewhere real", () => {
    for (const l of LANES) {
      expect(l.href.startsWith("/")).toBe(true);
      expect(l.href.length).toBeGreaterThan(3);
    }
    expect(LANES.find((l) => l.id === "admin")!.href).toBe("/admin");
    expect(LANES.find((l) => l.id === "keymaster")!.href).toBe("/app/keymaster");
    expect(LANES.find((l) => l.id === "keyholder")!.href).toBe("/app/keyholder");
  });

  it("no lane copy uses banned vocabulary", () => {
    const copy = LANES.map((l) => `${l.title} ${l.body}`).join(" ");
    expect(copy).not.toMatch(/\b(bet|wager|odds|rake|gambl|prediction|parlay)/i);
  });
});

describe("/start is a web page, not the app shell", () => {
  const layout = read("src/app/start/layout.tsx");
  const page = read("src/app/start/page.tsx");
  const css = read("src/app/start/start.css");

  it("does not import the phone shell", () => {
    // Match IMPORTS, not prose — both files mention AppFrame in a comment explaining what they
    // deliberately do not use.
    for (const src of [layout, page]) {
      expect(src).not.toMatch(/^\s*import[^;]*(AppFrame|BottomNav|TopNav)/m);
    }
  });

  it("uses ONE shared container, not a 430px phone column", () => {
    // The width lives in exactly one class, used by header AND body via <Shell>.
    expect(css).toMatch(/\.lk-web-shell \{[^}]*max-width: 13\d\dpx/);
    expect((css.match(/max-width: 13\d\dpx/g) || []).length).toBe(1);
    // The RULE, not the comment that explains why the phone column is not used here.
    expect(css).not.toMatch(/max-width:\s*430px/);
  });

  it("has a real site header and a policy footer", () => {
    expect(layout).toContain("How it works");
    expect(layout).toContain("Championship");
    expect(layout).toContain("Sign in");
    expect(layout).toContain("Responsible play");
  });

  it("gates roles SERVER-side, off the user doc", () => {
    expect(page).toContain("getCurrentUserProfile()");
    expect(page).toContain("visibleLanes(roles)");
    expect(page).toContain("profile.isAdmin === true");
  });

  it("the PWA install banner is suppressed at >=900px", () => {
    expect(read("src/components/pwa/PwaSetup.tsx")).toContain("max-[899px]:flex");
  });
});

describe("collapsed question column — root cause fixed, not papered over", () => {
  const beginner = read("src/app/app/beginner/BeginnerJourney.tsx");
  const feedCard = read("src/components/feed/SlateCard.tsx");

  it("the question is a shrinkable flex child at both sites", () => {
    expect(beginner).toContain('className="min-w-0 flex-1 text-[13px] font-semibold">{p.question}');
    expect(feedCard).toContain('className="min-w-0 flex-1 text-sm font-medium">{prediction.question}');
  });

  it("the sibling is pinned so it cannot starve the question instead", () => {
    expect(beginner).toContain('className="shrink-0 text-xs text-muted">{p.agreeA}');
    expect(feedCard).toContain('<span className="shrink-0"><Pill tone="ai">');
  });

  it("NOT papered over with nowrap or a fixed width", () => {
    for (const src of [beginner, feedCard]) {
      expect(src).not.toMatch(/whitespace-nowrap[^"]*\{(p|prediction)\.question\}/);
    }
  });
});

describe("beginner conversion hand-off reuses the existing mirroring", () => {
  const handoff = read("src/components/web/CashHandoff.tsx");

  it("carries the LIVE slate id the mirrored pick already holds", () => {
    expect(read("src/lib/beginner/types.ts")).toContain("slateId: string;");
    expect(read("src/app/app/beginner/BeginnerJourney.tsx")).toContain(
      "liveSlateId={legs[0]?.pick.slateId ?? null}",
    );
    expect(handoff).toContain("/app/slate/${slateId}");
  });

  it("no second mirroring implementation was written", () => {
    expect(handoff).toContain("fetchBeginnerFeed");
    expect(handoff).not.toMatch(/function .*[Mm]irror/);
  });

  it("renders on web only, so no mobile screen changes", () => {
    expect(handoff).toContain("if (!isWeb()) return null;");
    expect(read("src/components/web/BackToStart.tsx")).toContain("if (!isWeb()) return null;");
  });
});

/* ══ 6. Front-door layout defects (LI-WEB-LAYOUT-05) ════════════════════════════════════════════ */

describe("front door: one width system, opaque header", () => {
  const css = read("src/app/start/start.css");
  const layout = read("src/app/start/layout.tsx");
  const page = read("src/app/start/page.tsx");
  const shell = read("src/components/web/Shell.tsx");

  it("header and body go through the SAME container component", () => {
    expect(shell).toContain("lk-web-shell");
    // Neither file hand-writes the container class; both use <Shell>.
    expect(layout).toContain("<Shell");
    expect(page).toContain("<Shell");
    expect(layout).not.toMatch(/className="lk-web-shell/);
    expect(page).not.toMatch(/className="lk-web-shell/);
  });

  it("the width is defined exactly once", () => {
    expect((css.match(/max-width: 13\d\dpx/g) || []).length).toBe(1);
  });

  it("the sticky header is OPAQUE — content cannot scroll through it", () => {
    const block = css.slice(css.indexOf(".lk-web-header {"), css.indexOf("}", css.indexOf(".lk-web-header {")));
    expect(block).toContain("position: sticky");
    expect(block).not.toMatch(/rgba\([^)]*0\.\d+\s*\)/); // no translucent background
    expect(block).toContain("background: var(--web-bg)");
  });

  it("gutters are symmetric by construction (margin-inline auto, padding-inline)", () => {
    expect(css).toContain("margin-inline: auto");
    expect(css).toContain("padding-inline: 32px");
  });
});
