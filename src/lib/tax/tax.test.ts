import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  applyWinningToRollup,
  recordWinningForTax,
  EMPTY_ROLLUP,
} from "@/lib/ledger/winnings";
import { evaluateWithdrawal } from "@/lib/tax/withdrawal";
import { TAX_THRESHOLDS } from "@/lib/tax/config";

// Minimal Firestore fake: nested collection/doc refs + a transaction with
// get/set, tracking every write key.
function fakeFirestore(initial: Record<string, Record<string, unknown>> = {}) {
  const store = new Map<string, Record<string, unknown>>(
    Object.entries(initial),
  );
  const sets: string[] = [];
  function ref(key: string): {
    _key: string;
    collection: (sub: string) => { doc: (id: string) => ReturnType<typeof ref> };
  } {
    return {
      _key: key,
      collection: (sub: string) => ({ doc: (id: string) => ref(`${key}/${sub}/${id}`) }),
    };
  }
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async (r: { _key: string }) => ({
          exists: store.has(r._key),
          data: () => store.get(r._key),
        }),
        set: (r: { _key: string }, data: Record<string, unknown>) => {
          sets.push(r._key);
          store.set(r._key, { ...(store.get(r._key) ?? {}), ...data });
        },
      };
      return fn(tx);
    },
  };
  return { db, store, sets };
}

// ── (e) annual rollup + 1099 flag ────────────────────────────────────────────
describe("applyWinningToRollup — (e) annual totals + 1099 flag", () => {
  it("stays under threshold, then trips it exactly once", () => {
    let r = applyWinningToRollup(
      EMPTY_ROLLUP,
      { grossCents: 50000, entryFeeCents: 1000 },
      60000,
    );
    expect(r.taxReportingRequired).toBe(false);
    expect(r.netProfitCents).toBe(49000);
    expect(r.winCount).toBe(1);

    r = applyWinningToRollup(r, { grossCents: 20000, entryFeeCents: 1000 }, 60000);
    expect(r.grossWinningsCents).toBe(70000);
    expect(r.taxReportingRequired).toBe(true);
    expect(r.newlyRequired).toBe(true);
    expect(r.winCount).toBe(2);

    const r3 = applyWinningToRollup(r, { grossCents: 100, entryFeeCents: 0 }, 60000);
    expect(r3.newlyRequired).toBe(false); // already required — not "newly"
  });
});

// ── (d) immutable ledger + idempotent rollup ─────────────────────────────────
describe("recordWinningForTax — (d) immutable ledger", () => {
  const LEDGER = "winningsLedger/s1_u1";
  const YEAR = "users/u1/taxYears/2026";
  const arg = {
    uid: "u1",
    slateId: "s1",
    grossCents: 50000,
    entryFeeCents: 600,
    year: 2026,
  };

  it("records once and never double-counts or mutates the ledger", async () => {
    const { db, store, sets } = fakeFirestore();

    await recordWinningForTax(db as unknown as Firestore, arg);
    expect(store.get(LEDGER)!.grossWinningsCents).toBe(50000);
    expect(store.get(YEAR)!.grossWinningsCents).toBe(50000);

    // Duplicate settlement/retry → no-op.
    await recordWinningForTax(db as unknown as Firestore, arg);
    expect(store.get(YEAR)!.grossWinningsCents).toBe(50000); // not doubled
    expect(store.get(LEDGER)!.grossWinningsCents).toBe(50000); // unchanged
    expect(sets.filter((k) => k === LEDGER).length).toBe(1); // written once
  });
});

// ── (f) withdrawal W-9 gate: stranger blocked, architect exempt ───────────────
describe("evaluateWithdrawal — (f) W-9 above threshold + AML review", () => {
  const overThreshold = TAX_THRESHOLDS.tax1099ThresholdCents; // $600

  it("blocks a stranger above threshold with no W-9", () => {
    const r = evaluateWithdrawal(
      { user: {}, amountCents: overThreshold, w9OnFile: false, taxReportingRequired: false },
      TAX_THRESHOLDS,
    );
    expect(r).toMatchObject({ allowed: false, code: "w9_required" });
  });

  it("allows the SAME withdrawal for an architect (override, exempt)", () => {
    const r = evaluateWithdrawal(
      {
        user: { isArchitect: true },
        amountCents: overThreshold,
        w9OnFile: false,
        taxReportingRequired: false,
      },
      TAX_THRESHOLDS,
    );
    expect(r).toEqual({ allowed: true, amlReview: false });
  });

  it("allows a stranger below threshold with no W-9", () => {
    const r = evaluateWithdrawal(
      { user: {}, amountCents: 5000, w9OnFile: false, taxReportingRequired: false },
      TAX_THRESHOLDS,
    );
    expect(r).toEqual({ allowed: true, amlReview: false });
  });

  it("flags (not blocks) a large withdrawal for AML review", () => {
    const r = evaluateWithdrawal(
      {
        user: {},
        amountCents: TAX_THRESHOLDS.amlReviewThresholdCents,
        w9OnFile: true,
        taxReportingRequired: true,
      },
      TAX_THRESHOLDS,
    );
    expect(r).toEqual({ allowed: true, amlReview: true });
  });
});

// ── (g) practice never touches tax/AML ───────────────────────────────────────
describe("practice bypass — (g) static guard", () => {
  it("tax ledger is written only for CASH winners in real settlement", () => {
    const settle = readFileSync(
      resolve("src/server/settlement/settle.ts"),
      "utf8",
    );
    expect(settle).toContain("recordWinningForTax");
    expect(settle).toContain("r.payoutCents > 0"); // cash-only guard

    // Practice + beginner (play-money) settlement never record tax.
    for (const p of [
      "src/app/app/practice/actions.ts",
      "src/app/app/beginner/actions.ts",
    ]) {
      expect(readFileSync(resolve(p), "utf8")).not.toContain(
        "recordWinningForTax",
      );
    }
  });
});
