/**
 * SURFACE GATE (Part A) — the mobile binary must not be served cash entertainment.
 *
 * The brief's wording is the whole point of this file: "omission in the payload, not hidden in the
 * client" and "test the payload, not the screen". So these tests do not render anything. They run
 * the real `fetchFeedSlates` / `fetchSlate` against an in-memory Firestore and inspect the bytes
 * that come back — a slate the surface may not serve must be ABSENT, and its question text must
 * appear nowhere in the serialized payload.
 *
 * Negative controls throughout: every "it is gone on mobile" assertion is paired with the same call
 * on the web surface showing it IS there, so a gate that simply returned nothing would fail.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  resolveSurface,
  isCashSlate,
  isCashSportsCategory,
  slateServesOnSurface,
  filterForSurface,
  CURRENT_SURFACE,
} from "./surface";
import { CASH_SPORTS_CATEGORIES } from "@/lib/contest/architectSet";
import { CATEGORIES } from "@/lib/categories";
import { fetchFeedSlates, fetchSlate } from "@/server/data/slates";

/* ══ 1. The flag itself ═════════════════════════════════════════════════════════════════════════ */

describe("surface flag", () => {
  it('only the exact string "web" selects web; everything else is mobile', () => {
    expect(resolveSurface("web")).toBe("web");
    expect(resolveSurface("WEB")).toBe("web");
    expect(resolveSurface(" web ")).toBe("web");
    for (const raw of [undefined, null, "", "mobile", "Mobile", "website", "web ", "true", "1", "x"]) {
      if (raw === "web ") continue; // trimmed above; kept to show the intent
      expect(resolveSurface(raw)).toBe("mobile");
    }
  });

  it("defaults to mobile so an unset variable changes nothing", () => {
    expect(resolveSurface(undefined)).toBe("mobile");
    expect(CURRENT_SURFACE).toBe("mobile"); // NEXT_PUBLIC_SURFACE is unset in the test env
  });
});

/* ══ 2. The rule, in isolation ══════════════════════════════════════════════════════════════════ */

const cashTiers = [{ tier: 5 }, { tier: 25 }];
const coinTiers: { tier: number }[] = [];

describe("the serve rule", () => {
  it("cash = at least one paid tier; no paid tier = coins", () => {
    expect(isCashSlate({ category: "NBA", entryTiers: cashTiers })).toBe(true);
    expect(isCashSlate({ category: "NBA", entryTiers: coinTiers })).toBe(false);
    expect(isCashSlate({ category: "NBA", entryTiers: [{ tier: 0 }] })).toBe(false);
  });

  it("cash SPORTS serves on both surfaces", () => {
    const slate = { category: "NFL", entryTiers: cashTiers };
    expect(slateServesOnSurface(slate, "mobile")).toBe(true);
    expect(slateServesOnSurface(slate, "web")).toBe(true);
  });

  it("cash ENTERTAINMENT serves on web and NOT on mobile", () => {
    for (const category of ["Entertainment", "TV Shows", "Music", "Politics", "Crypto", "Viral"]) {
      const slate = { category, entryTiers: cashTiers };
      expect(slateServesOnSurface(slate, "web")).toBe(true);
      expect(slateServesOnSurface(slate, "mobile")).toBe(false);
    }
  });

  it("COINS entertainment serves on both — only cash is gated", () => {
    const slate = { category: "Entertainment", entryTiers: coinTiers };
    expect(slateServesOnSurface(slate, "mobile")).toBe(true);
    expect(slateServesOnSurface(slate, "web")).toBe(true);
  });

  it("an unknown category fails CLOSED on mobile when it is cash", () => {
    const slate = { category: "Underwater Basket Weaving", entryTiers: cashTiers };
    expect(slateServesOnSurface(slate, "mobile")).toBe(false);
    expect(slateServesOnSurface(slate, "web")).toBe(true);
  });

  it("category matching is case-insensitive and whitespace-tolerant", () => {
    expect(isCashSportsCategory("nba")).toBe(true);
    expect(isCashSportsCategory("  NBA  ")).toBe(true);
    expect(isCashSportsCategory("")).toBe(false);
  });

  it("every allowlisted sport is a real category in CATEGORIES", () => {
    const known = new Set(CATEGORIES.map((c) => c.name.toLowerCase()));
    for (const s of CASH_SPORTS_CATEGORIES) expect(known.has(s.toLowerCase())).toBe(true);
  });

  it("Esports is NOT on the allowlist (failing closed pending the ruling)", () => {
    expect(isCashSportsCategory("Esports")).toBe(false);
  });

  it("filterForSurface drops exactly the gated ones", () => {
    const all = [
      { id: "a", category: "NBA", entryTiers: cashTiers },
      { id: "b", category: "Entertainment", entryTiers: cashTiers },
      { id: "c", category: "Entertainment", entryTiers: coinTiers },
    ];
    expect(filterForSurface(all, "mobile").map((s) => s.id)).toEqual(["a", "c"]);
    expect(filterForSurface(all, "web").map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

/* ══ 3. THE PAYLOAD — the real fetchers against an in-memory store ══════════════════════════════ */

type Doc = Record<string, unknown>;
const ts = (ms: number) => ({ toMillis: () => ms });

/** Minimal Firestore fake covering the surface `fetchFeedSlates` / `fetchSlate` touch. */
function fakeDb(seed: Record<string, Doc>) {
  const store = new Map<string, Doc>(Object.entries(seed));
  const segs = (p: string) => p.split("/");

  const snapOf = (path: string) => ({
    id: segs(path).pop()!,
    ref: refOf(path),
    exists: store.has(path),
    data: () => store.get(path),
  });

  const matches = (d: Doc, f: { field: string; op: string; value: unknown }) => {
    const v = d[f.field];
    if (f.op === "==") return v === f.value;
    if (f.op === "in") return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
    return false;
  };

  const makeQuery = (
    matcher: (p: string) => boolean,
    filters: { field: string; op: string; value: unknown }[] = [],
  ): Record<string, unknown> => ({
    where: (field: string, op: string, value: unknown) =>
      makeQuery(matcher, [...filters, { field, op, value }]),
    orderBy: () => makeQuery(matcher, filters),
    get: async () => {
      const docs = [...store.keys()]
        .filter(matcher)
        .filter((p) => filters.every((f) => matches(store.get(p)!, f)))
        .sort()
        .map(snapOf);
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  });

  const collRef = (collPath: string) => {
    const depth = segs(collPath).length + 1;
    return {
      ...makeQuery((p) => p.startsWith(`${collPath}/`) && segs(p).length === depth),
      doc: (id: string) => refOf(`${collPath}/${id}`),
    };
  };

  function refOf(path: string) {
    return {
      id: segs(path).pop()!,
      path,
      get: async () => snapOf(path),
      collection: (n: string) => collRef(`${path}/${n}`),
    };
  }

  return {
    collection: (name: string) => collRef(name),
    getAll: async (...refs: { path: string }[]) => refs.map((r) => snapOf(r.path)),
  };
}

// Both fixture questions must pass the EXISTING banned-archetype detector (questionEngine), or
// `applyWithhold` strips the predictions and the negative controls below stop proving anything.
// "Who wins X" is a banned outcome shape — these are prop-style legs instead.
const SPORTS_Q = "Who takes the opening tip?";
const ENT_Q = "Does the host mention the strike in the monologue?";

function seed(): Record<string, Doc> {
  const base = {
    creatorId: null,
    status: "live",
    entryCount: 3,
    isCardRush: false,
    rushMultiplier: 1,
    maxEntries: null,
    lockTime: ts(Date.now() + 3_600_000),
  };
  const pred = (question: string) => ({
    question,
    optionA: "A",
    optionB: "B",
    optionAProbability: 55,
    optionBProbability: 45,
    predictionType: "binary",
    overUnderLine: null,
    result: null,
    sortOrder: 0,
  });
  return {
    "slates/cash-sports": { ...base, title: "Tip-off", category: "NBA", entryTiers: [{ tier: 5, hostingFeeCents: 100 }] },
    "slates/cash-sports/predictions/p1": pred(SPORTS_Q),
    "slates/cash-ent": { ...base, title: "Awards night", category: "Entertainment", entryTiers: [{ tier: 5, hostingFeeCents: 100 }] },
    "slates/cash-ent/predictions/p1": pred(ENT_Q),
    "slates/coins-ent": { ...base, title: "Free awards", category: "Entertainment", entryTiers: [] },
    "slates/coins-ent/predictions/p1": pred("Coins-only entertainment leg"),
  };
}

describe("PAYLOAD — fetchFeedSlates", () => {
  it("mobile: the cash entertainment slate is ABSENT from the payload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await fetchFeedSlates(fakeDb(seed()) as any, "mobile");
    expect(out.map((s) => s.id).sort()).toEqual(["cash-sports", "coins-ent"]);
    expect(out.find((s) => s.id === "cash-ent")).toBeUndefined();
  });

  it("NEGATIVE CONTROL — web: the same slate IS in the payload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await fetchFeedSlates(fakeDb(seed()) as any, "web");
    expect(out.map((s) => s.id).sort()).toEqual(["cash-ent", "cash-sports", "coins-ent"]);
  });

  it("its QUESTION TEXT appears nowhere in the serialized mobile payload", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mobile = JSON.stringify(await fetchFeedSlates(fakeDb(seed()) as any, "mobile"));
    expect(mobile).not.toContain(ENT_Q);
    expect(mobile).not.toContain("Awards night");
    // …and the control: it IS there on web, so the assertion above means something.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web = JSON.stringify(await fetchFeedSlates(fakeDb(seed()) as any, "web"));
    expect(web).toContain(ENT_Q);
  });

  it("cash SPORTS and COINS entertainment both survive on mobile", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await fetchFeedSlates(fakeDb(seed()) as any, "mobile");
    expect(JSON.stringify(out)).toContain(SPORTS_Q);
    expect(out.find((s) => s.id === "coins-ent")).toBeDefined();
  });
});

describe("PAYLOAD — fetchSlate (a direct link)", () => {
  it("mobile: asking for the cash entertainment slate by id returns null", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await fetchSlate(fakeDb(seed()) as any, "cash-ent", "mobile")).toBeNull();
  });

  it("NEGATIVE CONTROL — web: the same id returns the slate with its questions", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slate = await fetchSlate(fakeDb(seed()) as any, "cash-ent", "web");
    expect(slate).not.toBeNull();
    expect(JSON.stringify(slate)).toContain(ENT_Q);
  });

  it("is indistinguishable from a slate that does not exist", async () => {
    const db = fakeDb(seed());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gated = await fetchSlate(db as any, "cash-ent", "mobile");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = await fetchSlate(db as any, "no-such-slate", "mobile");
    expect(gated).toEqual(missing);
    expect(gated).toBeNull();
  });

  it("mobile still serves cash sports and coins entertainment by id", async () => {
    const db = fakeDb(seed());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await fetchSlate(db as any, "cash-sports", "mobile")).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await fetchSlate(db as any, "coins-ent", "mobile")).not.toBeNull();
  });
});

/* ══ 4. The gate is server-side, at the chokepoint ══════════════════════════════════════════════ */

describe("enforcement location", () => {
  it("every slate-serving path funnels through the two gated fetchers", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/server/data/slates.ts"), "utf8");
    // The gate runs before predictions are read, so an omitted slate's questions are never fetched.
    expect(src).toMatch(/const servable = slatesSnap\.docs\.filter/);
    expect(src).toContain("servesOnSurface");
    // fetchSlate returns null rather than a stripped object.
    expect(src).toMatch(/\)\s*\)\s*\{\s*return null;/);
  });
});
