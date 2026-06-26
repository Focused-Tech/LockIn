import {
  CATEGORY_PLAYS_SATURATION,
  REC_MIN_RESULTS,
  REC_WEIGHTS,
  RECENCY_WINDOW_MS,
} from "./constants";

/** Minimal slate shape the scorer needs (mapped from FeedSlate). */
export interface RecSlate {
  id: string;
  category: string;
  creatorId: string | null;
  tiers: number[];
  entryCount: number;
  lockTimeMs: number;
}

/** Per-user signals, gathered server-side from persisted data. */
export interface RecSignals {
  /** category → win rate (0–100). */
  categoryWinRates: Record<string, number>;
  /** category → settled plays. */
  categoryPlays: Record<string, number>;
  followedCreators: string[];
  /** entry tier value → times played. */
  tierCounts: Record<number, number>;
}

export interface Recommendation {
  slate: RecSlate;
  score: number;
  /** Human reason, or null when falling back to the chronological feed. */
  reason: string | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Has the user any personalization signal at all? */
export function hasHistory(signals: RecSignals): boolean {
  return (
    Object.keys(signals.categoryPlays).length > 0 ||
    signals.followedCreators.length > 0 ||
    Object.keys(signals.tierCounts).length > 0
  );
}

interface Components {
  affinity: number;
  follow: number;
  tierMatch: number;
  recency: number;
}

function components(
  slate: RecSlate,
  signals: RecSignals,
  nowMs: number,
): Components {
  // Category affinity: blend volume (how much you play it) with win rate.
  const plays = signals.categoryPlays[slate.category] ?? 0;
  const winRate = signals.categoryWinRates[slate.category] ?? 0;
  const volume = clamp01(plays / CATEGORY_PLAYS_SATURATION);
  const affinity = plays > 0 ? volume * (0.5 + 0.5 * (winRate / 100)) : 0;

  // Creator follow: 1 if you follow the host.
  const follow =
    slate.creatorId && signals.followedCreators.includes(slate.creatorId)
      ? 1
      : 0;

  // Tier match: share of your tier history this slate can satisfy.
  const totalTierPlays = Object.values(signals.tierCounts).reduce(
    (s, n) => s + n,
    0,
  );
  const matchedPlays = slate.tiers.reduce(
    (s, t) => s + (signals.tierCounts[t] ?? 0),
    0,
  );
  const tierMatch = totalTierPlays > 0 ? matchedPlays / totalTierPlays : 0;

  // Recency: slates locking sooner (still in the future) score higher.
  const untilLock = slate.lockTimeMs - nowMs;
  const recency = clamp01(1 - untilLock / RECENCY_WINDOW_MS);

  return { affinity, follow, tierMatch, recency };
}

function score(c: Components): number {
  return (
    REC_WEIGHTS.categoryAffinity * c.affinity +
    REC_WEIGHTS.creatorFollow * c.follow +
    REC_WEIGHTS.tierMatch * c.tierMatch +
    REC_WEIGHTS.recency * c.recency
  );
}

function reasonFor(slate: RecSlate, c: Components): string {
  if (c.follow === 1) return "From a creator you follow";
  if (c.affinity > 0.15) return `Based on your ${slate.category} picks`;
  return "Popular right now";
}

/**
 * Rank active slates for a user (deterministic — no LLM). Cold start (no signals)
 * ranks by entry count ("Popular right now"). Falls back to the chronological
 * feed (reason = null) when there are too few candidates to personalize.
 */
export function recommendSlates(
  slates: RecSlate[],
  signals: RecSignals,
  nowMs: number,
): Recommendation[] {
  if (slates.length < REC_MIN_RESULTS) {
    return [...slates]
      .sort((a, b) => a.lockTimeMs - b.lockTimeMs)
      .map((slate) => ({ slate, score: 0, reason: null }));
  }

  if (!hasHistory(signals)) {
    return [...slates]
      .sort((a, b) => b.entryCount - a.entryCount || a.lockTimeMs - b.lockTimeMs)
      .map((slate) => ({ slate, score: slate.entryCount, reason: "Popular right now" }));
  }

  return slates
    .map((slate) => {
      const c = components(slate, signals, nowMs);
      return { slate, score: score(c), reason: reasonFor(slate, c) };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.slate.entryCount - a.slate.entryCount ||
        a.slate.lockTimeMs - b.slate.lockTimeMs,
    );
}
