import {
  CROSS_PARLAY_MIN_PICKS,
  CROSS_PARLAY_MULTIPLIERS,
  FREE_ENTRY_COIN_COST,
  MIN_PARTICIPANTS_FOR_PAYOUT,
  TOP_PERCENT_PAID,
  type EntryTier,
} from "@/lib/constants";
import { computeRake } from "./rake";
import { computeRankPayout, payoutShareForRank } from "./payout";
import { scoreCard } from "./scoring";

/** Display multiplier for a parlay of N picks (0 if out of range). */
export function parlayMultiplier(pickCount: number): number {
  return CROSS_PARLAY_MULTIPLIERS[pickCount] ?? 0;
}

export interface ParlayPickResult {
  /** true = correct, false = incorrect, null = void (cancelled) or unresolved. */
  correct: boolean | null;
  lockTimeMs: number;
}

export interface ParlayInput {
  id: string;
  userId: string;
  entryTier: EntryTier;
  isPaid: boolean;
  submittedAtMs: number;
  picks: ParlayPickResult[];
}

export interface ParlayResult {
  id: string;
  userId: string;
  score: number;
  rank: number;
  payoutCents: number;
  payoutCoins: number;
  refunded: boolean;
}

export interface ParlayPoolSummary {
  key: string;
  isPaid: boolean;
  tier: EntryTier | null;
  count: number;
  grossPoolCents: number;
  rakeCents: number;
  prizePoolCents: number;
  distributedCents: number;
  distributedCoins: number;
  refunded: boolean;
  paidPositions: number;
}

export interface ParlaySettlement {
  results: ParlayResult[];
  pools: ParlayPoolSummary[];
}

/**
 * Score a parlay: same rules as a slate card (10 pts/correct, 1.2× consecutive,
 * 2× perfect) — over the resolved, non-void picks ordered by slate lock time.
 */
export function scoreParlay(picks: ParlayPickResult[]): number {
  const resolved = picks
    .filter((p) => p.correct !== null)
    .sort((a, b) => a.lockTimeMs - b.lockTimeMs);
  return scoreCard(resolved.map((p) => p.correct as boolean));
}

const validCount = (p: ParlayInput) =>
  p.picks.filter((x) => x.correct !== null).length;

/**
 * Settle a batch of ready parlays into their own per-tier pools — same rake,
 * payout curve, and 1,000× cap as slates. Parlays left with fewer than the
 * minimum valid picks (slates cancelled) are refunded; a paid pool under the
 * participant floor refunds in full. Free pools pay coins.
 */
export function settleParlays(
  inputs: ParlayInput[],
  opts?: { prizeMultiplier?: number },
): ParlaySettlement {
  const prizeMultiplier = opts?.prizeMultiplier ?? 1;
  const results: ParlayResult[] = [];
  const pools: ParlayPoolSummary[] = [];

  const groups = new Map<string, ParlayInput[]>();
  for (const p of inputs) {
    const key = p.isPaid ? `paid:${p.entryTier}` : "free";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
  }

  for (const [key, group] of groups) {
    const isPaid = key !== "free";
    const tier = isPaid ? group[0]!.entryTier : null;
    const entryFeeCents = isPaid && tier ? tier * 100 : 0;

    // Parlays with too few valid picks (cancelled slates) → individual refund.
    const competing = group.filter((p) => validCount(p) >= CROSS_PARLAY_MIN_PICKS);
    const voided = group.filter((p) => validCount(p) < CROSS_PARLAY_MIN_PICKS);
    for (const p of voided) {
      results.push({
        id: p.id,
        userId: p.userId,
        score: scoreParlay(p.picks),
        rank: 0,
        payoutCents: isPaid ? entryFeeCents : 0,
        payoutCoins: isPaid ? 0 : FREE_ENTRY_COIN_COST,
        refunded: true,
      });
    }

    const scored = competing
      .map((p) => ({ p, score: scoreParlay(p.picks) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.p.submittedAtMs - b.p.submittedAtMs ||
          (a.p.id < b.p.id ? -1 : 1),
      );

    const count = scored.length;
    const positions = Math.round(count * TOP_PERCENT_PAID);
    let grossPoolCents = 0;
    let rakeCents = 0;
    let prizePoolCents = 0;
    let distributedCents = 0;
    let distributedCoins = 0;
    let refunded = false;

    if (isPaid && tier) {
      grossPoolCents = count * entryFeeCents;
      if (count > 0 && count < MIN_PARTICIPANTS_FOR_PAYOUT) {
        refunded = true;
        scored.forEach((s, i) => {
          distributedCents += entryFeeCents;
          results.push({
            id: s.p.id,
            userId: s.p.userId,
            score: s.score,
            rank: i + 1,
            payoutCents: entryFeeCents,
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
          let payoutCents = 0;
          if (rank <= positions) {
            payoutCents = computeRankPayout(rank, prizePoolCents, entryFeeCents)
              .payoutCents;
          }
          distributedCents += payoutCents;
          results.push({
            id: s.p.id,
            userId: s.p.userId,
            score: s.score,
            rank,
            payoutCents,
            payoutCoins: 0,
            refunded: false,
          });
        });
      }
    } else {
      const coinPool = Math.round(count * FREE_ENTRY_COIN_COST * prizeMultiplier);
      scored.forEach((s, i) => {
        const rank = i + 1;
        const payoutCoins =
          rank <= positions ? Math.floor(coinPool * payoutShareForRank(rank)) : 0;
        distributedCoins += payoutCoins;
        results.push({
          id: s.p.id,
          userId: s.p.userId,
          score: s.score,
          rank,
          payoutCents: 0,
          payoutCoins,
          refunded: false,
        });
      });
    }

    pools.push({
      key,
      isPaid,
      tier,
      count,
      grossPoolCents,
      rakeCents,
      prizePoolCents,
      distributedCents,
      distributedCoins,
      refunded,
      paidPositions: positions,
    });
  }

  return { results, pools };
}
