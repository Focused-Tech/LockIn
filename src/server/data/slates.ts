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
      return feedSlate;
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

  return {
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
}
