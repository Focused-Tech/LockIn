/**
 * ACCOUNT DELETION + DATA EXPORT — the gate.
 *
 * Apple 5.1.1(v) and Google both require in-app account deletion that works. Both rows were inert
 * stubs, so the bar for this test is not "the code compiles" — it is that a deletion has actually
 * been RUN and the store inspected afterwards. That is what the in-memory Firestore below is for.
 *
 * Three things are proved here:
 *   1. The personal-data map is exhaustive over COLLECTIONS — a new collection cannot be added to
 *      the registry and silently skipped by the deleter.
 *   2. The blockers fire on known-bad input (negative control) and stay quiet on a clean account.
 *   3. Running the deleter over a seeded store leaves NO document anywhere still carrying the uid —
 *      and the same sweep, run before deletion, finds it, so the sweep itself is not vacuous.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COLLECTIONS } from "@/lib/firebase/types";
import {
  PERSONAL_DATA_MAP,
  ARRAY_MEMBERSHIPS,
  DELETED_USER_SENTINEL,
  actionableRules,
  exportableRules,
  retentionSummary,
} from "./personalData";
import { evaluateBlockers, canDelete, type BlockerInput } from "./blockers";
import { deleteAccountData } from "./deletion";
import { buildDataExport, exportFilename, REDACTED } from "./export";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/* ══ 1. The map is exhaustive ═══════════════════════════════════════════════════════════════════ */

describe("personal-data map covers every collection", () => {
  it("classifies each key of COLLECTIONS exactly once", () => {
    const registry = Object.keys(COLLECTIONS).sort();
    const mapped = PERSONAL_DATA_MAP.map((r) => r.collection).sort();
    expect(mapped).toEqual(registry);
  });

  it("no collection is classified twice", () => {
    const seen = new Set<string>();
    for (const r of PERSONAL_DATA_MAP) {
      expect(seen.has(r.collection)).toBe(false);
      seen.add(r.collection);
    }
  });

  it('"none" means no locators, and any locator means a real strategy', () => {
    for (const r of PERSONAL_DATA_MAP) {
      if (r.strategy === "none") expect(r.locators).toHaveLength(0);
      else expect(r.locators.length).toBeGreaterThan(0);
    }
  });

  it("every rule carries a reason (it is shown to the user)", () => {
    for (const r of PERSONAL_DATA_MAP) expect(r.why.trim().length).toBeGreaterThan(20);
  });

  it("the retention summary is derived from the map, not hand-written", () => {
    const { kept, removed } = retentionSummary();
    expect(kept).toHaveLength(PERSONAL_DATA_MAP.filter((r) => r.strategy === "anonymize").length);
    expect(removed).toHaveLength(PERSONAL_DATA_MAP.filter((r) => r.strategy === "delete").length);
    expect(kept.length + removed.length).toBe(actionableRules().length);
  });

  it("moderation ledgers are the only user-data collections withheld from the export", () => {
    const withheld = PERSONAL_DATA_MAP.filter((r) => !r.exportable && r.strategy !== "none").map(
      (r) => r.collection,
    );
    expect(withheld).toContain("locksmithReports");
    expect(withheld).toContain("contentReports");
    // Everything else withheld must be a per-device/seen-record, never money or user content.
    for (const c of withheld) {
      expect(["locksmithReports", "contentReports", "triviaSeen", "tutorials", "championshipCards", "usernames"]).toContain(c);
    }
    expect(exportableRules().length).toBeGreaterThan(10);
  });
});

/* ══ 2. Blockers — negative controls ════════════════════════════════════════════════════════════ */

const CLEAN: BlockerInput = {
  cashBalanceCents: 0,
  pendingWithdrawals: 0,
  pendingDeposits: 0,
  openEntries: 0,
  openHostedContests: 0,
};

describe("deletion blockers", () => {
  it("a clean account is deletable (the gate is not just always-on)", () => {
    expect(evaluateBlockers(CLEAN)).toEqual([]);
    expect(canDelete(CLEAN)).toBe(true);
  });

  const badInputs: [string, Partial<BlockerInput>][] = [
    ["CASH_BALANCE", { cashBalanceCents: 1250 }],
    ["PENDING_WITHDRAWAL", { pendingWithdrawals: 1 }],
    ["PENDING_DEPOSIT", { pendingDeposits: 2 }],
    ["OPEN_ENTRIES", { openEntries: 3 }],
    ["OPEN_HOSTED_CONTESTS", { openHostedContests: 1 }],
  ];

  for (const [code, patch] of badInputs) {
    it(`fires ${code} on known-bad input`, () => {
      const blockers = evaluateBlockers({ ...CLEAN, ...patch });
      expect(blockers.map((b) => b.code)).toContain(code);
      expect(canDelete({ ...CLEAN, ...patch })).toBe(false);
    });
  }

  it("reports every blocker at once, not just the first", () => {
    const all = evaluateBlockers({
      cashBalanceCents: 500,
      pendingWithdrawals: 1,
      pendingDeposits: 1,
      openEntries: 1,
      openHostedContests: 1,
    });
    expect(all).toHaveLength(5);
  });

  it("names the amount so the player knows what to withdraw", () => {
    const [b] = evaluateBlockers({ ...CLEAN, cashBalanceCents: 4200 });
    expect(b!.message).toContain("$42.00");
    expect(b!.needsPlayerAction).toBe(true);
  });

  it("blockers that clear on their own say so", () => {
    const [b] = evaluateBlockers({ ...CLEAN, openEntries: 2 });
    expect(b!.needsPlayerAction).toBe(false);
    expect(b!.message).toMatch(/contests/);
  });

  it("uses no wagering vocabulary", () => {
    const every = evaluateBlockers({
      cashBalanceCents: 100,
      pendingWithdrawals: 1,
      pendingDeposits: 1,
      openEntries: 1,
      openHostedContests: 1,
    })
      .map((b) => b.message)
      .join(" ");
    expect(every).not.toMatch(/\b(bet|wager|odds|rake|gambl)/i);
  });
});

/* ══ 3. The deletion, actually executed ═════════════════════════════════════════════════════════ */

type Doc = Record<string, unknown>;

/** Minimal in-memory Firestore — only the surface `deleteAccountData` touches. */
function fakeDb(seed: Record<string, Doc>) {
  const store = new Map<string, Doc>(Object.entries(seed));
  const segs = (p: string) => p.split("/");

  const snapOf = (path: string) => ({
    id: segs(path).pop()!,
    ref: refOf(path),
    exists: store.has(path),
    data: () => store.get(path),
  });

  const refOf = (path: string) => ({
    id: segs(path).pop()!,
    path,
    get: async () => snapOf(path),
    delete: async () => void store.delete(path),
    collection: (n: string) => collRef(`${path}/${n}`),
  });

  const matches = (d: Doc, f: { field: string; op: string; value: unknown }) => {
    const v = d[f.field];
    if (f.op === "==") return v === f.value;
    if (f.op === "in") return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
    if (f.op === "array-contains") return Array.isArray(v) && v.includes(f.value);
    return false;
  };

  const makeQuery = (
    matcher: (p: string) => boolean,
    filters: { field: string; op: string; value: unknown }[] = [],
  ) => ({
    where: (field: string, op: string, value: unknown) =>
      makeQuery(matcher, [...filters, { field, op, value }]),
    get: async () => {
      const docs = [...store.keys()]
        .filter(matcher)
        .filter((p) => filters.every((f) => matches(store.get(p)!, f)))
        .map(snapOf);
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  });

  const collRef = (collPath: string) => {
    const depth = segs(collPath).length + 1;
    const q = makeQuery((p) => p.startsWith(`${collPath}/`) && segs(p).length === depth);
    return { ...q, doc: (id: string) => refOf(`${collPath}/${id}`) };
  };

  return {
    __store: store,
    collection: (name: string) => collRef(name),
    collectionGroup: (name: string) =>
      makeQuery((p) => {
        const s = segs(p);
        return s.length >= 2 && s[s.length - 2] === name;
      }),
    batch: () => {
      const ops: (() => void)[] = [];
      return {
        delete: (ref: { path: string }) => ops.push(() => store.delete(ref.path)),
        update: (ref: { path: string }, data: Doc) =>
          ops.push(() => {
            const cur = store.get(ref.path);
            if (!cur) return;
            for (const [k, v] of Object.entries(data)) {
              // Real FieldValue.arrayRemove(...) — an ArrayRemoveTransform carrying `elements`.
              if (v && typeof v === "object" && v.constructor?.name === "ArrayRemoveTransform") {
                const rm = (v as unknown as { elements: unknown[] }).elements;
                cur[k] = ((cur[k] as unknown[]) ?? []).filter((x) => !rm.includes(x));
              } else {
                cur[k] = v;
              }
            }
          }),
        commit: async () => ops.forEach((op) => op()),
      };
    },
    recursiveDelete: async (ref: { path: string }) => {
      for (const p of [...store.keys()]) {
        if (p === ref.path || p.startsWith(`${ref.path}/`)) store.delete(p);
      }
    },
  };
}

const UID = "user_alice";
const OTHER = "user_bob";

function seedStore(): Record<string, Doc> {
  return {
    // The profile and its subcollections
    [`users/${UID}`]: { username: "Alice", email: "a@x.com", cashBalanceCents: 0, followedCreators: [OTHER] },
    [`users/${UID}/categoryStats/nba`]: { plays: 4 },
    [`users/${UID}/tutorials/beginner`]: { seen: true },
    [`users/${UID}/creatorSignatures/v1_a`]: { signed: true },
    // Another player, who follows Alice
    [`users/${OTHER}`]: { username: "Bob", followedCreators: [UID, "user_carol"] },
    // Handle reservation
    "usernames/alice": { uid: UID },
    "usernames/bob": { uid: OTHER },
    // Own records → delete
    [`slates/s1/entries/${UID}`]: { userId: UID, score: 7 },
    [`slates/s2/entries/${OTHER}`]: { userId: OTHER, score: 3 },
    "beginnerEntries/be1": { userId: UID },
    "crossParlays/cp1": { userId: UID },
    [`practiceContests/pc1/practiceEntries/${UID}`]: { userId: UID },
    "packagePurchases/pk1_alice": { userId: UID, packageId: "pk1" },
    [`creatorApplications/${UID}`]: { status: "approved" },
    [`referrals/${UID}`]: { referrerUid: OTHER, referredUid: UID },
    // Money + other people's dependencies → anonymize
    "deposits/d1": { userId: UID, amountCents: 5000, status: "succeeded" },
    "withdrawals/w1": { userId: UID, amountCents: 2000, status: "completed" },
    "creatorEarnings/e1": { creatorId: UID, netCents: 900 },
    "slates/s1": { creatorId: UID, status: "settled", title: "Friday night" },
    "pickPackages/pp1": { creatorId: UID, slateId: "s1" },
    "practiceContests/pc1": { hostId: UID, status: "settled" },
    "keyholderEvents/ke1": { keyholderUid: OTHER, referredUid: UID },
    "enrolmentKeys/k1": { keymasterUid: OTHER, redeemedByUid: UID },
    "locksmithReports/lr1": { userId: UID, message: "hi" },
    "contentReports/cr1": { reporterId: UID, creatorId: OTHER },
    // Untouched third-party data
    "deposits/d2": { userId: OTHER, amountCents: 100, status: "succeeded" },
    "triviaQuestions/q1": { stem: "who?" },
  };
}

/** Every path whose document still mentions `uid` anywhere in its values. */
function pathsMentioning(store: Map<string, Doc>, uid: string): string[] {
  const hit = (v: unknown): boolean => {
    if (v === uid) return true;
    if (Array.isArray(v)) return v.some(hit);
    if (v && typeof v === "object") return Object.values(v).some(hit);
    return false;
  };
  return [...store.entries()].filter(([p, d]) => hit(d) || p.includes(uid)).map(([p]) => p);
}

describe("deleteAccountData, executed against a seeded store", () => {
  it("NEGATIVE CONTROL — before deletion, the sweep finds the uid all over the store", () => {
    const db = fakeDb(seedStore());
    const found = pathsMentioning(db.__store, UID);
    // If this ever returns [], the post-deletion assertion below proves nothing.
    expect(found.length).toBeGreaterThan(15);
    expect(found).toContain(`users/${UID}`);
    expect(found).toContain("deposits/d1");
  });

  it("leaves NO document anywhere still carrying the uid", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    expect(pathsMentioning(db.__store, UID)).toEqual([]);
  });

  it("deletes the profile, its subcollections, and the username reservation", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    for (const p of [
      `users/${UID}`,
      `users/${UID}/categoryStats/nba`,
      `users/${UID}/tutorials/beginner`,
      `users/${UID}/creatorSignatures/v1_a`,
      "usernames/alice",
    ]) {
      expect(db.__store.has(p)).toBe(false);
    }
  });

  it("deletes the player's own records", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    for (const p of [
      `slates/s1/entries/${UID}`,
      "beginnerEntries/be1",
      "crossParlays/cp1",
      `practiceContests/pc1/practiceEntries/${UID}`,
      "packagePurchases/pk1_alice",
      `creatorApplications/${UID}`,
      `referrals/${UID}`,
    ]) {
      expect(db.__store.has(p)).toBe(false);
    }
  });

  it("KEEPS the money records, with the account link severed", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });

    const deposit = db.__store.get("deposits/d1");
    expect(deposit).toBeDefined();
    expect(deposit!.amountCents).toBe(5000); // the record itself is intact
    expect(deposit!.userId).toBe(DELETED_USER_SENTINEL);

    expect(db.__store.get("withdrawals/w1")!.userId).toBe(DELETED_USER_SENTINEL);
    expect(db.__store.get("creatorEarnings/e1")!.creatorId).toBe(DELETED_USER_SENTINEL);
  });

  it("KEEPS contests other players entered, with the host link severed", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });

    const slate = db.__store.get("slates/s1");
    expect(slate).toBeDefined();
    expect(slate!.title).toBe("Friday night");
    expect(slate!.creatorId).toBe(DELETED_USER_SENTINEL);
    expect(db.__store.get("pickPackages/pp1")!.creatorId).toBe(DELETED_USER_SENTINEL);
    expect(db.__store.get("practiceContests/pc1")!.hostId).toBe(DELETED_USER_SENTINEL);
  });

  it("removes the uid from other players' follow lists", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    expect(db.__store.get(`users/${OTHER}`)!.followedCreators).toEqual(["user_carol"]);
  });

  it("touches nothing belonging to another player", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });

    expect(db.__store.get("deposits/d2")).toEqual({ userId: OTHER, amountCents: 100, status: "succeeded" });
    expect(db.__store.get(`slates/s2/entries/${OTHER}`)).toEqual({ userId: OTHER, score: 3 });
    expect(db.__store.get("usernames/bob")).toEqual({ uid: OTHER });
    expect(db.__store.get("triviaQuestions/q1")).toEqual({ stem: "who?" });
    // Bob keeps his side of the shared records.
    expect(db.__store.get("keyholderEvents/ke1")!.keyholderUid).toBe(OTHER);
    expect(db.__store.get("enrolmentKeys/k1")!.keymasterUid).toBe(OTHER);
    expect(db.__store.get("contentReports/cr1")!.creatorId).toBe(OTHER);
  });

  it("does not release a username reservation that points at somebody else", async () => {
    const seed = seedStore();
    seed["usernames/alice"] = { uid: "someone_else" };
    const db = fakeDb(seed);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    expect(db.__store.get("usernames/alice")).toEqual({ uid: "someone_else" });
  });

  it("reports what it did", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receipt = await deleteAccountData(db as any, UID, { username: "Alice" });
    expect(receipt.deletedDocs).toBeGreaterThan(5);
    expect(receipt.anonymizedDocs).toBeGreaterThan(5);
    expect(receipt.arrayMembershipsScrubbed).toBe(1);
    expect(receipt.perCollection.find((c) => c.collection === "deposits")?.anonymized).toBe(1);
  });

  it("is idempotent — a second run over the emptied store is a no-op", async () => {
    const db = fakeDb(seedStore());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    const after = new Map(db.__store);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteAccountData(db as any, UID, { username: "Alice" });
    expect([...db.__store.entries()]).toEqual([...after.entries()]);
  });
});

/* ══ 3b. The export, actually executed ══════════════════════════════════════════════════════════ */

describe("buildDataExport, executed against a seeded store", () => {
  const NOW = "2026-08-17T12:00:00.000Z";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = () => buildDataExport(fakeDb(seedStore()) as any, UID, NOW);

  it("returns the profile, not an empty envelope", async () => {
    const out = await run();
    expect(out.format).toBe("lockin-data-export/1");
    expect(out.generatedAt).toBe(NOW);
    expect(out.account).toEqual({ uid: UID, username: "Alice" });
    expect(out.profile).toMatchObject({ username: "Alice", email: "a@x.com" });
  });

  it("returns the player's records across collections", async () => {
    const out = await run();
    expect(Object.keys(out.records).length).toBeGreaterThan(5);
    expect(out.records.deposits?.[0]?.data).toMatchObject({ amountCents: 5000 });
    expect(out.records.entries?.[0]?.path).toBe(`slates/s1/entries/${UID}`);
    expect(out.records.crossParlays).toHaveLength(1);
    expect(out.records.categoryStats?.[0]?.data).toMatchObject({ plays: 4 });
    expect(out.records.creatorSignatures).toHaveLength(1);
  });

  it("NEGATIVE CONTROL — an account with no data yields no records, so a hit means something", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empty = await buildDataExport(fakeDb({}) as any, "nobody", NOW);
    expect(empty.profile).toBeNull();
    expect(Object.keys(empty.records)).toEqual([]);
  });

  it("never hands out another player's account id", async () => {
    const out = await run();
    // Records are shared rows (a referral, an enrolment key) — the counterparty's id is redacted.
    const blob = JSON.stringify(out.records);
    expect(blob).not.toContain(OTHER);
    expect(blob).not.toContain("user_carol");
    expect(blob).toContain(REDACTED);
    // …and the same on the profile's inbound-relationship fields.
    const seed = seedStore();
    seed[`users/${UID}`] = { ...seed[`users/${UID}`], referredBy: OTHER, keyholderUid: OTHER };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out2 = await buildDataExport(fakeDb(seed) as any, UID, NOW);
    expect(out2.profile!.referredBy).toBe(REDACTED);
    expect(out2.profile!.keyholderUid).toBe(REDACTED);
  });

  it("keeps the user's OWN values in redacted fields (redaction is not blanket)", async () => {
    const seed = seedStore();
    // Alice is the referrer on this row — her own id must survive.
    seed[`referrals/${UID}`] = { referrerUid: UID, referredUid: OTHER };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await buildDataExport(fakeDb(seed) as any, UID, NOW);
    const row = out.records.referrals![0]!.data;
    expect(row.referrerUid).toBe(UID);
    expect(row.referredUid).toBe(REDACTED);
  });

  it("names what it deliberately withholds, rather than omitting it silently", async () => {
    const out = await run();
    const names = out.withheld.map((w) => w.collection);
    expect(names).toContain("locksmithReports");
    expect(names).toContain("contentReports");
    for (const w of out.withheld) expect(w.reason.length).toBeGreaterThan(20);
  });

  it("serialises to valid JSON (the file the player actually receives)", async () => {
    const out = await run();
    const text = JSON.stringify(out, null, 2);
    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.length).toBeGreaterThan(500);
  });

  it("builds a safe filename", () => {
    expect(exportFilename("Alice", "2026-08-17T12:00:00.000Z")).toBe("lockin-data-Alice-2026-08-17.json");
    expect(exportFilename("bad/../name", "2026-08-17T00:00:00.000Z")).toBe("lockin-data-badname-2026-08-17.json");
    expect(exportFilename(null, "2026-08-17T00:00:00.000Z")).toBe("lockin-data-account-2026-08-17.json");
  });
});

/* ══ 4. Wiring — the stubs are gone and the uid comes from the session ══════════════════════════ */

describe("the Settings rows are no longer inert stubs", () => {
  const view = read("src/app/app/settings/SettingsView.tsx");

  it("renders the working components instead of a dead LinkRow", () => {
    expect(view).toContain("<DeleteAccountRow />");
    expect(view).toContain("<DownloadMyDataRow />");
    expect(view).not.toMatch(/<LinkRow\s+title="Delete account"/);
    expect(view).not.toMatch(/<LinkRow\s+title="Download my data"/);
  });

  it("both rows reach a server action", () => {
    const rows = read("src/app/app/settings/AccountDataRows.tsx");
    for (const fn of ["deleteMyAccount", "getDeletionStatus", "getMyDataExport"]) {
      expect(rows).toContain(fn);
    }
  });
});

describe("no request shape reaches another account", () => {
  it("the export route reads the uid from the verified session, never a parameter", () => {
    const route = read("src/app/api/account/export/route.ts");
    expect(route).toContain("getCurrentUser()");
    expect(route).toContain("user.uid");
    expect(route).not.toMatch(/searchParams|params\.|req\.json\(\)/);
    expect(route).toContain('"Cache-Control": "no-store"');
  });

  it("the actions take the uid from the session, not from their arguments", () => {
    const actions = read("src/app/app/settings/actions.ts");
    expect(actions).toContain("getCurrentUserProfile()");
    // The only argument accepted anywhere is the typed confirmation phrase.
    expect(actions).toMatch(/deleteMyAccount\(confirmPhrase: string\)/);
    expect(actions).not.toMatch(/\buid: string\b/);
  });

  it("the confirmation phrase is verified server-side, not just in the UI", () => {
    const actions = read("src/app/app/settings/actions.ts");
    expect(actions).toMatch(/confirmPhrase\.trim\(\)\.toLowerCase\(\) !== profile\.username\.toLowerCase\(\)/);
  });
});

describe("deletion ordering", () => {
  const src = read("src/server/account/deletion.ts");

  it("re-checks the blockers server-side inside the deleting call", () => {
    expect(src).toMatch(/evaluateBlockers\(await gatherBlockerInput\(db, uid, profile\)\)/);
    expect(src).toContain("throw new DeletionBlockedError(blockers)");
  });

  it("deletes the auth user AFTER the data, so a mid-way failure leaves the account recoverable", () => {
    const dataAt = src.indexOf("await deleteAccountData(db, uid, profile)");
    const authAt = src.indexOf("adminAuth().deleteUser(uid)");
    expect(dataAt).toBeGreaterThan(-1);
    expect(authAt).toBeGreaterThan(dataAt);
  });

  it("scrubs every array membership the map declares", () => {
    expect(ARRAY_MEMBERSHIPS.length).toBeGreaterThan(0);
    for (const m of ARRAY_MEMBERSHIPS) expect(src).toContain("array-contains");
  });
});
