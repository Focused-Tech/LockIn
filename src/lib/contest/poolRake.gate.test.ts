import { describe, it, expect } from "vitest";
import { settleEntries, type SettlementEntryInput } from "./settlement";
import { poolSizeRake } from "./poolRake";
import { rakeForPool } from "./potModel";
import type { EntryTier } from "@/lib/constants";

/**
 * GATE — settlement is on the ONE pool-size economy (architect ruling, Jul 28).
 *
 * Three pool sizes spanning a band boundary ($5K: 20%→30%) and the $10K knee
 * (30%→40%, log region). For each: (a) the raked amount equals the canonical
 * curve EXACTLY, (b) the builder preview (rakeForPool) and live settlement
 * return the identical number for the same pool, (c) the coin pool takes ZERO
 * rake. The canon rate here is hand-derived from the ledger, independent of the
 * code under test — so this asserts the curve, not the code against itself.
 */

// Canonical curve, dollars in — from the ledger, NOT imported from the code.
function canonRate(poolDollars: number): number {
  if (poolDollars < 1000) return 0.15;
  if (poolDollars < 5000) return 0.2;
  if (poolDollars < 10000) return 0.3;
  return Math.min(0.65, 0.4 + 0.0675 * Math.log10(poolDollars / 10000));
}

const results: Record<string, "a"> = { p1: "a" };
const order = ["p1"];

function makeEntries(
  n: number,
  opts: { isPaid?: boolean } = {},
): SettlementEntryInput[] {
  const { isPaid = true } = opts;
  return Array.from({ length: n }, (_, i) => ({
    id: `e${String(i).padStart(6, "0")}`,
    userId: `u${i}`,
    entryTier: 5 as EntryTier,
    hostingFeeCents: 100,
    isPaid,
    submittedAtMs: i,
    picks: [{ predictionId: "p1", choice: "a" }],
  }));
}

// $5 entries → gross in cents. 500→$2,500 (20% band) · 1000→$5,000 (30% band,
// across the $5K boundary) · 2000→$10,000 (the knee → 40%).
const CASES = [
  { entries: 500, poolDollars: 2500 },
  { entries: 1000, poolDollars: 5000 },
  { entries: 2000, poolDollars: 10000 },
];

describe("GATE: settlement rakes on the pool-size curve, exact to canon", () => {
  it.each(CASES)(
    "$%s pool ($poolDollars): raked amount == canonical curve",
    ({ entries, poolDollars }) => {
      const grossCents = poolDollars * 100;
      const expectedRakeCents = Math.floor(grossCents * canonRate(poolDollars));

      const { groups } = settleEntries(makeEntries(entries), results, order);
      const paid = groups.find((g) => g.isPaid)!;

      expect(paid.grossPoolCents).toBe(grossCents);
      expect(paid.rakeCents).toBe(expectedRakeCents); // exact to canon
    },
  );

  it.each(CASES)(
    "$%s pool ($poolDollars): builder preview == live settlement (one function)",
    ({ entries, poolDollars }) => {
      const grossCents = poolDollars * 100;

      const { groups } = settleEntries(makeEntries(entries), results, order);
      const settledRake = groups.find((g) => g.isPaid)!.rakeCents;

      // The builder preview path (rakeForPool, dollars) and the settlement path
      // (poolSizeRake, cents) must produce the IDENTICAL raked number.
      const previewRake = Math.floor(grossCents * rakeForPool(poolDollars));
      expect(previewRake).toBe(settledRake);
      expect(poolSizeRake(grossCents).rakeCents).toBe(settledRake);
    },
  );

  it("the coin (free) pool still settles with ZERO rake", () => {
    const { groups } = settleEntries(
      makeEntries(1000, { isPaid: false }),
      results,
      order,
    );
    const free = groups.find((g) => !g.isPaid)!;
    expect(free.rakeCents).toBe(0);
    expect(free.grossPoolCents).toBe(0); // free pool is coins, no cash gross
    expect(free.distributedCoins).toBeGreaterThan(0);
  });
});
