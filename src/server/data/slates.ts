import "server-only";
import { unstable_cache } from "next/cache";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type PredictionDoc,
  type SlateDoc,
} from "@/lib/firebase/types";
import { FEED_STATUSES, type FeedPrediction, type FeedSlate } from "@/lib/feed";
import { getPlayerContext } from "@/server/feeds/creatorGames";
import { firstBannedLeg } from "@/lib/contest/questionEngine";

/**
 * COMPLIANCE gate on the DISPLAY path: if any leg is a banned archetype, the slate is WITHHELD — its
 * predictions are stripped (no banned text reaches the client) and it renders in a visible "under
 * review" state instead of as a normal contest. Applied to every feed + single-slate fetch.
 */
function applyWithhold(slate: FeedSlate): FeedSlate {
  const banned = firstBannedLeg(slate.predictions);
  if (!banned) return slate;
  console.warn(`[compliance] withholding slate ${slate.id} — banned leg "${banned.question}" (${banned.archetype})`);
  return { ...slate, predictions: [], withheld: true };
}

/**
 * Fetch the Explore feed: all slates in {@link FEED_STATUSES} with their
 * predictions, shaped as serializable {@link FeedSlate} DTOs and sorted by lock
 * time (soonest first). Used by both the feed server component and the slates
 * tRPC router.
 */
export async function fetchFeedSlates(db: Firestore): Promise<FeedSlate[]> {
  const slatesSnap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "in", FEED_STATUSES)
    .get();

  const slates = await Promise.all(
    slatesSnap.docs.map(async (slateDoc) => {
      const slate = slateDoc.data() as SlateDoc;

      const predsSnap = await slateDoc.ref
        .collection(COLLECTIONS.predictions)
        .orderBy("sortOrder", "asc")
        .get();

      const predictions: FeedPrediction[] = predsSnap.docs.map((p) => {
        const pred = p.data() as PredictionDoc;
        return {
          id: p.id,
          question: pred.question,
          optionA: pred.optionA,
          optionB: pred.optionB,
          probA: pred.optionAProbability ?? 50,
          probB: pred.optionBProbability ?? 50,
          type: pred.predictionType,
          line: pred.overUnderLine,
          result: pred.result,
        };
      });

      const feedSlate: FeedSlate = {
        id: slateDoc.id,
        title: slate.title,
        category: slate.category,
        status: slate.status,
        creatorId: slate.creatorId,
        entryTiers: slate.entryTiers,
        entryCount: slate.entryCount ?? 0,
        isCardRush: slate.isCardRush ?? false,
        rushMultiplier: slate.rushMultiplier ?? 1,
        maxEntries: slate.maxEntries ?? null,
        lockTimeMs: slate.lockTime.toMillis(),
        predictions,
      };
      return applyWithhold(feedSlate);
    }),
  );

  return slates.sort((a, b) => a.lockTimeMs - b.lockTimeMs);
}

/**
 * Cached Explore feed for the SSR payload. The feed (slates + predictions) is
 * identical for every user, so it's cached globally with a short revalidate
 * instead of re-running the N+1 (1 slates query + 1 predictions query per slate)
 * on every request. Safe because the client `ExploreFeed` subscribes via
 * `onSnapshot` and reconciles live entry counts / pools — a ≤15s-stale SSR list
 * is fine. Per-user personalization stays out of here (see `fetchRecSignals`).
 */
export const fetchFeedSlatesCached = unstable_cache(
  async (): Promise<FeedSlate[]> => fetchFeedSlates(adminDb()),
  ["explore-feed-slates"],
  { revalidate: 15, tags: ["feed-slates"] },
);

/** Fetch a single slate + its predictions as a {@link FeedSlate}, or null. */
export async function fetchSlate(
  db: Firestore,
  slateId: string,
): Promise<FeedSlate | null> {
  const slateDoc = await db
    .collection(COLLECTIONS.slates)
    .doc(slateId)
    .get();
  if (!slateDoc.exists) return null;
  const slate = slateDoc.data() as SlateDoc;

  const predsSnap = await slateDoc.ref
    .collection(COLLECTIONS.predictions)
    .orderBy("sortOrder", "asc")
    .get();

  const predictions: FeedPrediction[] = await Promise.all(
    predsSnap.docs.map(async (p): Promise<FeedPrediction> => {
      const pred = p.data() as PredictionDoc & {
        playerIds?: Record<string, string>;
        context?: { seasonAverage: string; last3Form: string; matchupNote: string };
      };
      const base: FeedPrediction = {
        id: p.id,
        question: pred.question,
        optionA: pred.optionA,
        optionB: pred.optionB,
        probA: pred.optionAProbability ?? 50,
        probB: pred.optionBProbability ?? 50,
        type: pred.predictionType,
        line: pred.overUnderLine,
        result: pred.result,
      };
      if (pred.predictionType !== "archetype" || !pred.proOptions) return base;

      // §1.2 — pull each player's context (season avg + last-out) from statsProvider at play time.
      const playerIds = pred.playerIds ?? {};
      const ids = [...new Set(Object.values(playerIds).filter(Boolean))];
      const ctx = await getPlayerContext(ids).catch(() => []);
      const ctxById = new Map(ctx.map((c) => [c.playerId, c]));
      let contextError: string | null = null;

      const options = pred.proOptions.map((o) => {
        const names = o.playerNames ?? [];
        const label = names.length ? names.join(" + ") : o.key;
        // player options carry context; bucket options (milestone) do not.
        const cs = names.map((n) => ctxById.get(playerIds[n] ?? "")).filter(Boolean);
        if (names.length && cs.length < names.length) {
          contextError = `Stats unavailable for ${names.filter((n) => !ctxById.get(playerIds[n] ?? "")).join(", ")} — this leg can't be entered yet.`;
        }
        return {
          key: o.key,
          label,
          seasonAverage: cs.length ? cs.map((c) => c!.seasonAverage).join(" · ") : undefined,
          last3Form: cs.length ? cs.map((c) => c!.last3Form).join(" · ") : undefined,
        };
      });

      return { ...base, archetype: pred.archetype, gameLine: pred.context?.matchupNote ?? null, options, contextError };
    }),
  );

  return applyWithhold({
    id: slateDoc.id,
    title: slate.title,
    category: slate.category,
    status: slate.status,
    creatorId: slate.creatorId,
    entryTiers: slate.entryTiers,
    entryCount: slate.entryCount ?? 0,
    isCardRush: slate.isCardRush ?? false,
    rushMultiplier: slate.rushMultiplier ?? 1,
    maxEntries: slate.maxEntries ?? null,
    lockTimeMs: slate.lockTime.toMillis(),
    predictions,
  });
}
