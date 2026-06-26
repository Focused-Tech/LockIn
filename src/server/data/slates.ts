import "server-only";
import type { Firestore } from "firebase-admin/firestore";
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
