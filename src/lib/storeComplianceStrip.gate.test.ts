/**
 * STORE COMPLIANCE STRIP — the app must not invite anyone to the cash entertainment product
 * (DEV_HANDOFF_STORE_COMPLIANCE_STRIP_v2_2026-08-17.md). Cash sports, coin play (any category), the
 * wallet/Stripe/withdrawals, creator earnings, the keyholder portal, entry tiers, and the Championship
 * are all untouched by this — this gate only asserts the removal itself.
 *
 * Most of the gate lives inside `server-only` server actions (submitEntry, createSlate,
 * submitCrossParlay) that vitest can't import directly (no bundler here to strip the boundary), so
 * this file follows the repo's existing source-read pattern (see contest/rakeSwap.gate.test.ts)
 * instead of executing them.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CATEGORIES, SPORTS_CATEGORIES, isSportsCategory } from "./categories";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("sports/non-sports classification", () => {
  it("every sports category is a real category, and the split covers every category exactly once", () => {
    const names = CATEGORIES.map((c) => c.name);
    for (const s of SPORTS_CATEGORIES) expect(names).toContain(s);
    for (const name of names) {
      expect(isSportsCategory(name)).toBe(SPORTS_CATEGORIES.has(name));
    }
  });
  it("the named examples (Pop Culture / Reality TV / Music) and the rest of non-sports are excluded", () => {
    // "Pop Culture" / "Reality TV" aren't in the canonical CATEGORIES list (only Entertainment/TV
    // Shows/Music are) — asserting the ones that exist, plus the full non-sports set per the letter
    // of the ruling ("any other non-sports category"), not just the three named examples.
    for (const nonSports of ["Entertainment", "TV Shows", "Music", "Politics", "Geopolitics", "Crypto", "Economics", "Weather", "Viral"]) {
      expect(isSportsCategory(nonSports)).toBe(false);
    }
    for (const sports of ["NASCAR", "Esports", "UFC", "Boxing", "Tennis", "Golf", "Soccer", "NFL", "NBA", "MLB", "NHL"]) {
      expect(isSportsCategory(sports)).toBe(true);
    }
  });
});

describe("the app and the website share an origin — the User-Agent marker is the only signal", () => {
  it("capacitor.config.ts's appendUserAgent matches MOBILE_APP_UA_MARKER exactly", () => {
    const marker = /MOBILE_APP_UA_MARKER = "([^"]+)"/.exec(read("src/lib/mobileClient.ts"))?.[1];
    const configured = /appendUserAgent: "([^"]+)"/.exec(read("capacitor.config.ts"))?.[1];
    expect(marker).toBeTruthy();
    expect(configured).toBe(marker);
  });
});

describe("the ONE cash-entry surface: submitEntry", () => {
  const src = read("src/app/app/slate/[id]/actions.ts");
  it("rejects a cash entry in a non-sports category from the native client, before the balance debit", () => {
    const gateIdx = src.indexOf("isSportsCategory(slate.category) && isMobileClientUA");
    const debitIdx = src.indexOf("cashBalanceCents: user.cashBalanceCents -");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(debitIdx).toBeGreaterThan(gateIdx);
  });
  it("the gate only fires on a paid entry (!input.free) — coin entries are unaffected", () => {
    expect(src).toContain("!input.free && !isSportsCategory(slate.category) && isMobileClientUA");
  });
});

describe("the second cash-entry surface: cross-parlay (Chains)", () => {
  it("submitCrossParlay carries the same gate, per leg", () => {
    const src = read("src/components/cross-parlay/actions.ts");
    expect(src).toContain("!input.free && !isSportsCategory(slate.category) && isMobile");
  });
});

describe("creator hosting: createSlate", () => {
  it("a mobile creator can't publish a non-sports slate (every slate here requires a paid tier)", () => {
    const src = read("src/app/app/create/actions.ts");
    expect(src).toContain("!isSportsCategory(input.category) && isMobileClientUA");
    // tiers.min(1) — untouched per the ruling (§5 of the RULINGS message: "change nothing in that
    // surface, including the .min(1) → .min(2) line").
    expect(src).toContain('tiers: z.array(tierSchema).min(1, "Offer at least one entry tier")');
  });
});

describe("visibility: feed + direct routes never SHOW a blocked slate to the app", () => {
  it("fetchFeedSlates / fetchSlate filter on blockCashEntertainment", () => {
    const src = read("src/server/data/slates.ts");
    expect(src).toContain("function isCashEntertainmentSlate");
    expect(src).toContain("export function filterForClient");
    expect(src).toContain("if (opts?.blockCashEntertainment && isCashEntertainmentSlate(result)) return null;");
  });
  it("every reachable route (feed, direct slate, share, embed, rush, tRPC) passes isMobile through", () => {
    const sites = [
      "src/app/app/page.tsx",
      "src/app/app/slate/[id]/page.tsx",
      "src/app/s/[id]/page.tsx",
      "src/app/embed/[id]/page.tsx",
      "src/app/app/rush/page.tsx",
    ];
    for (const f of sites) {
      const src = read(f);
      expect(src).toContain("isMobileClientUA");
      expect(src).toContain("blockCashEntertainment");
    }
    // the tRPC feed endpoint is a public HTTP route — it can't rely on the SSR page gate, so it
    // reads the signal from its own context instead of the header directly.
    expect(read("src/server/routers/slates.ts")).toContain("blockCashEntertainment: ctx.isMobile");
    expect(read("src/server/context.ts")).toContain("isMobileClientUA(req.headers.get(\"user-agent\"))");
  });
});

describe("must-not-change — everything the ruling explicitly protects", () => {
  it("the Championship survives untouched", () => {
    for (const f of [
      "src/lib/championship/strip.ts",
      "src/lib/championship/triggers.ts",
      "src/app/app/championship/page.tsx",
    ]) {
      expect(() => read(f)).not.toThrow();
    }
  });
  it("the Fox Pit tower is untouched by this PR (separate branch — see §4 of the handoff)", () => {
    const fox = read("src/app/app/foxpit/room/[room]/FoxPitGame.tsx");
    expect(fox).not.toContain("isSportsCategory");
    expect(fox).not.toContain("isMobileClientUA");
  });
  it("no literal reference to the website domain was added anywhere in the strip's own edits", () => {
    for (const f of [
      "src/app/app/slate/[id]/actions.ts",
      "src/components/cross-parlay/actions.ts",
      "src/app/app/create/actions.ts",
      "src/server/data/slates.ts",
    ]) {
      expect(read(f)).not.toContain("lockin.llc");
    }
  });
});
