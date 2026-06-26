import { computeSlateMetrics } from "@/lib/contest";
import type { EntryTier } from "@/lib/constants";
import type { FeedSlate } from "@/lib/feed";

export type EmbedState = "live" | "locked" | "settled";

export interface EmbedPrediction {
  question: string;
  optionA: string;
  optionB: string;
  probA: number;
  probB: number;
  result: "a" | "b" | null;
}

/** Serializable, state-aware view of a slate for the public widget + share page. */
export interface EmbedView {
  id: string;
  title: string;
  category: string;
  state: EmbedState;
  lockTimeMs: number;
  entryCount: number;
  prizePoolCents: number;
  firstPlaceCents: number;
  firstPlaceMultiple: number;
  entryCostCents: number;
  isCardRush: boolean;
  rushMultiplier: number;
  maxEntries: number | null;
  predictions: EmbedPrediction[];
  /** Settled only: % of resolved questions where the AI favorite was correct. */
  accuracyPct: number | null;
}

export function buildEmbedView(slate: FeedSlate): EmbedView {
  const state: EmbedState =
    slate.status === "live"
      ? "live"
      : slate.status === "settled"
        ? "settled"
        : "locked";

  const tiers = [...slate.entryTiers].sort((a, b) => a.tier - b.tier);
  const primary = tiers[0];
  const tier = (primary?.tier ?? 5) as EntryTier;
  const hostingFeeCents = primary?.hostingFeeCents ?? 0;
  const m = computeSlateMetrics(
    tier,
    hostingFeeCents,
    slate.entryCount,
    slate.rushMultiplier,
  );

  let resolved = 0;
  let correct = 0;
  for (const p of slate.predictions) {
    if (p.result === "a" || p.result === "b") {
      resolved += 1;
      const favorite = p.probA >= p.probB ? "a" : "b";
      if (favorite === p.result) correct += 1;
    }
  }
  const accuracyPct =
    state === "settled" && resolved > 0
      ? Math.round((correct / resolved) * 100)
      : null;

  return {
    id: slate.id,
    title: slate.title,
    category: slate.category,
    state,
    lockTimeMs: slate.lockTimeMs,
    entryCount: slate.entryCount,
    prizePoolCents: m.prizePoolCents,
    firstPlaceCents: m.firstPlaceCents,
    firstPlaceMultiple: m.firstPlaceMultiple,
    entryCostCents: m.entryCostCents,
    isCardRush: slate.isCardRush,
    rushMultiplier: slate.rushMultiplier,
    maxEntries: slate.maxEntries,
    predictions: slate.predictions.map((p) => ({
      question: p.question,
      optionA: p.optionA,
      optionB: p.optionB,
      probA: p.probA,
      probB: p.probB,
      result: p.result,
    })),
    accuracyPct,
  };
}
