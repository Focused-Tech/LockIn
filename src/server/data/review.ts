import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type PredictionDoc,
  type SlateDoc,
} from "@/lib/firebase/types";

export interface ReviewPrediction {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  /** Evidence gathered by the verifier ("source: detail" lines). */
  evidence: string[];
  /** Aggregate verifier confidence, 0–100. */
  confidence: number | null;
}

export interface ReviewSlate {
  id: string;
  title: string;
  category: string;
  entryCount: number;
  predictions: ReviewPrediction[];
}

/** Slates routed to manual review (status `pending_review`) + their evidence. */
export async function fetchPendingReviewSlates(
  db: Firestore,
): Promise<ReviewSlate[]> {
  const snap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "==", "pending_review")
    .get();

  const slates = await Promise.all(
    snap.docs.map(async (slateDoc) => {
      const slate = slateDoc.data() as SlateDoc;
      const predsSnap = await slateDoc.ref
        .collection(COLLECTIONS.predictions)
        .orderBy("sortOrder", "asc")
        .get();

      const predictions: ReviewPrediction[] = predsSnap.docs.map((p) => {
        const pred = p.data() as PredictionDoc;
        return {
          id: p.id,
          question: pred.question,
          optionA: pred.optionA,
          optionB: pred.optionB,
          evidence: pred.verificationSources ?? [],
          confidence: pred.verificationConfidence,
        };
      });

      return {
        id: slateDoc.id,
        title: slate.title,
        category: slate.category,
        entryCount: slate.entryCount ?? 0,
        predictions,
      };
    }),
  );

  return slates;
}
