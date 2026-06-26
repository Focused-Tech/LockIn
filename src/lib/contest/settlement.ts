import {
  FREE_ENTRY_COIN_COST,
  MIN_PARTICIPANTS_FOR_PAYOUT,
  TOP_PERCENT_PAID,
  type EntryTier,
} from "@/lib/constants";
import { computeRake } from "./rake";
import { computeRankPayout, payoutShareForRank } from "./payout";
import { scoreCard } from "./scoring";

/**
 * Settlement orchestration: verify outcomes → score cards → rank → distribute.
 * The Firestore-applying orchestrator lives in src/server/settlement; this
 * module owns the pure math so it can be unit-tested against the spec's figures.
 */

/**
 * Whether a slate has enough paid participants to pay cash.
 * Below the threshold the slate auto-converts to free and entries are refunded.
 */
export function isEligibleForCashPayout(paidParticipants: number): boolean {
  return paidParticipants >= MIN_PARTICIPANTS_FOR_PAYOUT;
}

export interface SettlementEntryInput {
  id: string;
  userId: string;
  entryTier: EntryTier;
  hostingFeeCents: number;
  isPaid: boolean;
  submittedAtMs: number;
  picks: { predictionId: string; choice: "a" | "b" }[];
}

export interface SettlementEntryResult {
  id: string;
  userId: string;
  score: number;
  rank: number;
  payoutCents: number;
  payoutCoins: number;
  refunded: boolean;
}

export interface SettlementGroup {
  key: string;
  isPaid: boolean;
  tier: EntryTier | null;
  count: number;
  grossPoolCents: number;
  rakeCents: number;
  prizePoolCents: number;
  distributedCents: number;
  overflowCents: number;
  distributedCoins: number;
  refunded: boolean;
  paidPositions: number;
}

export interface SettlementSummary {
  entries: SettlementEntryResult[];
  groups: SettlementGroup[];
}

function scoreEntry(
  entry: SettlementEntryInput,
  results: Record<string, "a" | "b">,
  order: string[],
): number {
  const byPred = new Map(entry.picks.map((p) => [p.predictionId, p.choice]));
  const correct = order.map((pid) => {
    const choice = byPred.get(pid);
    const res = results[pid];
    return choice !== undefined && res !== undefined && choice === res;
  });
  return scoreCard(correct);
}

/**
 * Settle a slate's entries.
 *
 * Each paid TIER is its own pool (single buy-in fairness): gross = count ×
 * entry fee, rake by tier, top 25% paid via the curve + 1,000× cap. A tier with
 * fewer than {@link MIN_PARTICIPANTS_FOR_PAYOUT} entries is fully refunded
 * (entry + hosting). The free tier is a separate pool paid in coins.
 *
 * Ranking is score desc, then earlier submission, then id (deterministic).
 */
export function settleEntries(
  entries: SettlementEntryInput[],
  results: Record<string, "a" | "b">,
  predictionOrder: string[],
  options: { prizeMultiplier?: number } = {},
): SettlementSummary {
  const prizeMultiplier = Math.max(1, options.prizeMultiplier ?? 1);
  const groups = new Map<string, SettlementEntryInput[]>();
  for (const e of entries) {
    const key = e.isPaid ? `paid:${e.entryTier}` : "free";
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(e);
  }

  const entryResults: SettlementEntryResult[] = [];
  const groupSummaries: SettlementGroup[] = [];

  for (const [key, groupEntries] of groups) {
    const isPaid = key !== "free";
    const tier = isPaid ? groupEntries[0]!.entryTier : null;

    const scored = groupEntries
      .map((e) => ({ e, score: scoreEntry(e, results, predictionOrder) }))
      .sort(
        (x, y) =>
          y.score - x.score ||
          x.e.submittedAtMs - y.e.submittedAtMs ||
          (x.e.id < y.e.id ? -1 : 1),
      );

    const count = scored.length;
    const paidPositions = Math.round(count * TOP_PERCENT_PAID);

    let grossPoolCents = 0;
    let rakeCents = 0;
    let prizePoolCents = 0;
    let distributedCents = 0;
    let overflowCents = 0;
    let distributedCoins = 0;
    let refunded = false;

    if (isPaid && tier) {
      const entryFeeCents = tier * 100;
      grossPoolCents = count * entryFeeCents;

      if (count < MIN_PARTICIPANTS_FOR_PAYOUT) {
        // Auto-convert to free: refund every entry (entry + hosting).
        refunded = true;
        scored.forEach((s, i) => {
          const refund = entryFeeCents + s.e.hostingFeeCents;
          distributedCents += refund;
          entryResults.push({
            id: s.e.id,
            userId: s.e.userId,
            score: s.score,
            rank: i + 1,
            payoutCents: refund,
            payoutCoins: 0,
            refunded: true,
          });
        });
      } else {
        const rake = computeRake(tier, grossPoolCents);
        rakeCents = rake.rakeCents;
        prizePoolCents = Math.round(rake.prizePoolCents * prizeMultiplier);
        scored.forEach((s, i) => {
          const rank = i + 1;
          const entryCost = entryFeeCents + s.e.hostingFeeCents;
          let payoutCents = 0;
          if (rank <= paidPositions) {
            const rp = computeRankPayout(rank, prizePoolCents, entryCost);
            payoutCents = rp.payoutCents;
            overflowCents += rp.overflowCents;
          }
          distributedCents += payoutCents;
          entryResults.push({
            id: s.e.id,
            userId: s.e.userId,
            score: s.score,
            rank,
            payoutCents,
            payoutCoins: 0,
            refunded: false,
          });
        });
      }
    } else {
      // Free pool — paid in coins, no rake, no cap. Boosted for a Card Rush.
      const coinPool = Math.round(count * FREE_ENTRY_COIN_COST * prizeMultiplier);
      scored.forEach((s, i) => {
        const rank = i + 1;
        const payoutCoins =
          rank <= paidPositions
            ? Math.floor(coinPool * payoutShareForRank(rank))
            : 0;
        distributedCoins += payoutCoins;
        entryResults.push({
          id: s.e.id,
          userId: s.e.userId,
          score: s.score,
          rank,
          payoutCents: 0,
          payoutCoins,
          refunded: false,
        });
      });
    }

    groupSummaries.push({
      key,
      isPaid,
      tier,
      count,
      grossPoolCents,
      rakeCents,
      prizePoolCents,
      distributedCents,
      overflowCents,
      distributedCoins,
      refunded,
      paidPositions,
    });
  }

  return { entries: entryResults, groups: groupSummaries };
}
