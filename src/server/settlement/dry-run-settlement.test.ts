import { describe, expect, it } from "vitest";
import { aggregateVotes } from "@/lib/ai/verification/aggregate";
import type { SourceVote, VerdictPolicy } from "@/lib/ai/verification/types";
import {
  settleEntries,
  type SettlementEntryInput,
} from "@/lib/contest/settlement";
import {
  AUTO_SETTLE_CONFIDENCE,
  HOSTING_FEE_SPLIT,
  MIN_PARTICIPANTS_FOR_PAYOUT,
  MIN_VERIFICATION_SOURCES,
} from "@/lib/constants";

/**
 * End-to-end "real-money-style" settlement dry-run, exercised against the actual
 * pure engine + verifier aggregator (no network / no Firestore). Mirrors what
 * settleSlate does: verify each outcome → route confident ones to settlement and
 * the rest to manual review → run the payout engine → compute the creator's
 * hosting split.
 */

const POLICY: VerdictPolicy = {
  minSources: MIN_VERIFICATION_SOURCES,
  autoSettleConfidence: AUTO_SETTLE_CONFIDENCE,
};
const vote = (
  source: string,
  choice: "a" | "b" | null,
  confidence: number,
): SourceVote => ({ source, choice, confidence, detail: `${source} → ${choice}` });

describe("dry-run: verification routing", () => {
  it("auto-settles confident outcomes and routes the rest to review", () => {
    // p1 — sports binary confirmed by an authoritative feed (+ agreeing prior).
    const p1 = aggregateVotes(
      [vote("espn", "a", 0.99), vote("ai-prior", "a", 0.72)],
      POLICY,
    );
    // p2 — data feed disagrees with the prior → conflict.
    const p2 = aggregateVotes(
      [vote("coingecko", "a", 0.99), vote("ai-prior", "b", 0.6)],
      POLICY,
    );
    // p3 — only the AI prior could weigh in.
    const p3 = aggregateVotes([vote("ai-prior", "b", 0.95)], POLICY);

    expect(p1.autoSettle).toBe(true);
    expect(p2.autoSettle).toBe(false); // conflict
    expect(p3.autoSettle).toBe(false); // no authoritative source, no quorum

    const needsReview = [p1, p2, p3].some((v) => !v.autoSettle);
    expect(needsReview).toBe(true); // → slate routes to pending_review

    // eslint-disable-next-line no-console
    console.log(
      `[verify] p1 auto=${p1.autoSettle} conf=${p1.confidence.toFixed(2)} | ` +
        `p2 auto=${p2.autoSettle} agree=${p2.agreement.toFixed(2)} | ` +
        `p3 auto=${p3.autoSettle} → routed to manual review`,
    );
  });
});

describe("dry-run: settlement payouts (admin-resolved outcomes)", () => {
  const order = ["p1", "p2", "p3"];
  const results: Record<string, "a" | "b"> = { p1: "a", p2: "a", p3: "b" };
  const opposite = (c: "a" | "b") => (c === "a" ? "b" : "a");

  /** Build N entries for a tier; picks vary by index to spread scores/ranks. */
  function field(
    tier: 5 | 10 | 25,
    isPaid: boolean,
    n: number,
    startId: number,
  ): SettlementEntryInput[] {
    const hostingFeeCents = isPaid ? tier * 20 : 0; // $1/$2/$5-ish fees
    return Array.from({ length: n }, (_, i) => {
      const correctCount = i % 4; // 0..3 correct → four score tiers
      const picks = order.map((pid, j) => {
        const res = results[pid]!;
        return { predictionId: pid, choice: j < correctCount ? res : opposite(res) };
      });
      return {
        id: `${isPaid ? `p${tier}` : "free"}-${startId + i}`,
        userId: `u-${isPaid ? `p${tier}` : "free"}-${startId + i}`,
        entryTier: tier,
        hostingFeeCents,
        isPaid,
        submittedAtMs: startId + i,
        picks,
      };
    });
  }

  const inputs = [
    ...field(5, true, 60, 0), // $5 — paid out
    ...field(10, true, 30, 1000), // $10 — paid out
    ...field(25, true, 12, 2000), // $25 — below MIN_PARTICIPANTS → refunded
    ...field(5, false, 40, 3000), // free coin pool
  ];

  const summary = settleEntries(inputs, results, order, { prizeMultiplier: 1 });
  const group = (key: string) => summary.groups.find((g) => g.key === key)!;

  it("refunds the under-min tier and pays the others", () => {
    expect(group("paid:25").refunded).toBe(true); // 12 < 20
    expect(group("paid:5").refunded).toBe(false);
    expect(group("paid:10").refunded).toBe(false);
  });

  it("never distributes more than each prize pool and honors the cap", () => {
    for (const g of summary.groups) {
      expect(g.overflowCents).toBeGreaterThanOrEqual(0);
      // A paid-out pool can't distribute more than its prize pool.
      if (!g.refunded) {
        expect(g.distributedCents).toBeLessThanOrEqual(g.prizePoolCents);
      }
    }
    // A refunded tier returns every entrant's full entry cost (stake + fee).
    expect(group("paid:25").distributedCents).toBe(12 * (25 * 100 + 25 * 20));

    const maxPayout = Math.max(...summary.entries.map((e) => e.payoutCents));
    // 1,000× the largest entry cost is the ceiling; this small field is far under.
    expect(maxPayout).toBeLessThanOrEqual(1000 * (25 * 100 + 500));
  });

  it("pays the free tier in coins, not cash", () => {
    const free = group("free");
    expect(free.distributedCents).toBe(0);
    expect(free.distributedCoins).toBeGreaterThan(0);
  });

  it("computes the creator's 40% hosting split on non-refunded paid entries", () => {
    const hostingGross = inputs
      .filter((e) => e.isPaid && !group(`paid:${e.entryTier}`).refunded)
      .reduce((s, e) => s + e.hostingFeeCents, 0);
    const creatorNet = Math.floor(hostingGross * HOSTING_FEE_SPLIT.creator);
    // $5: 60×100 + $10: 30×200 = 12,000; creator keeps 40% = $48.00
    expect(hostingGross).toBe(12_000);
    expect(creatorNet).toBe(4_800);

    const winners = summary.entries.filter((e) => e.payoutCents > 0).length;
    const refunded = summary.entries.filter((e) => e.refunded).length;
    // eslint-disable-next-line no-console
    console.log(
      `[settle] ${inputs.length} entries | winners=${winners} refunded=${refunded} ` +
        `| pools: ${summary.groups
          .map((g) => `${g.key}=$${(g.prizePoolCents / 100).toFixed(0)}`)
          .join(" ")} | creator hosting=$${(creatorNet / 100).toFixed(2)}`,
    );
    expect(MIN_PARTICIPANTS_FOR_PAYOUT).toBe(20); // sanity: refund threshold
  });
});
