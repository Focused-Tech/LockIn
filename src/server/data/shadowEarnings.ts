import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type EntryDoc,
  type EntryPick,
  type EntryTierConfig,
  type PredictionDoc,
} from "@/lib/firebase/types";
import { settleEntries, type SettlementEntryInput } from "@/lib/contest";

/** What a free player would have won had they entered the smallest paid tier. */
export interface ShadowEarnings {
  /** The paid tier modeled (e.g. 5 → "the $5 contest"). */
  tier: number;
  /** Cash the player's exact card would have won in that paid pool. */
  wouldHaveWonCents: number;
  /** The rank that card would have taken, including the player. */
  rank: number | null;
  /** Entrants in that pool, including the player. */
  fieldSize: number;
}

const SHADOW_ID = "__shadow__";

/**
 * Compute shadow earnings for a free entry: drop the player's real picks into the
 * actual paid pool of the slate's smallest tier and re-run the settlement engine,
 * so the figure honors the same curve / cap / top-25% / min-participant rules as a
 * real payout. Returns null when it can't be modeled (no paid tier, predictions
 * unresolved). Cheap re-use of the pure engine — no balances are touched.
 */
export async function computeShadowEarnings(
  db: Firestore,
  slateId: string,
  slate: { entryTiers: EntryTierConfig[]; rushMultiplier: number },
  userPicks: EntryPick[],
  userSubmittedAtMs: number,
): Promise<ShadowEarnings | null> {
  const target = [...slate.entryTiers].sort((a, b) => a.tier - b.tier)[0];
  if (!target) return null; // no paid tier to model

  const slateRef = db.collection(COLLECTIONS.slates).doc(slateId);

  // Resolved predictions in pick order (needed to score cards).
  const predsSnap = await slateRef
    .collection(COLLECTIONS.predictions)
    .orderBy("sortOrder", "asc")
    .get();
  const order: string[] = [];
  const results: Record<string, "a" | "b"> = {};
  for (const d of predsSnap.docs) {
    const p = d.data() as PredictionDoc;
    if (p.result !== "a" && p.result !== "b") return null; // not fully settled
    order.push(d.id);
    results[d.id] = p.result;
  }

  // The target tier's real paid entries + a synthetic entry for the player.
  const entriesSnap = await slateRef.collection(COLLECTIONS.entries).get();
  const inputs: SettlementEntryInput[] = [];
  for (const d of entriesSnap.docs) {
    const e = d.data() as EntryDoc;
    if (!e.isPaid || e.entryTier !== target.tier) continue;
    inputs.push({
      id: d.id,
      userId: e.userId,
      entryTier: e.entryTier,
      hostingFeeCents: e.hostingFeeCents,
      isPaid: true,
      submittedAtMs: e.submittedAt?.toMillis?.() ?? 0,
      picks: e.picks,
    });
  }
  inputs.push({
    id: SHADOW_ID,
    userId: SHADOW_ID,
    entryTier: target.tier,
    hostingFeeCents: target.hostingFeeCents,
    isPaid: true,
    submittedAtMs: userSubmittedAtMs,
    picks: userPicks,
  });

  const summary = settleEntries(inputs, results, order, {
    prizeMultiplier: slate.rushMultiplier ?? 1,
  });
  const me = summary.entries.find((r) => r.id === SHADOW_ID);
  if (!me) return null;

  return {
    tier: target.tier,
    wouldHaveWonCents: me.refunded ? 0 : me.payoutCents,
    rank: me.rank,
    fieldSize: inputs.length,
  };
}
