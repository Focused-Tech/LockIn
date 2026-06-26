import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type PredictionDoc, type SlateDoc } from "@/lib/firebase/types";
import { CATEGORIES } from "@/lib/categories";
import { OnboardingFlow } from "./OnboardingFlow";
import { SAMPLE_SLATE, type GuidedSlate } from "./guided";

export default async function OnboardingPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const guided = await loadGuidedSlate();

  return <OnboardingFlow categories={[...CATEGORIES]} guided={guided} />;
}

/**
 * Load one live slate + its first prediction for the tour, else the sample.
 * A fresh database simply falls back to the sample.
 */
async function loadGuidedSlate(): Promise<GuidedSlate> {
  const db = adminDb();

  const slateSnap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "==", "live")
    .orderBy("lockTime", "asc")
    .limit(1)
    .get();

  const slateDoc = slateSnap.docs[0];
  if (!slateDoc) return SAMPLE_SLATE;
  const slate = slateDoc.data() as SlateDoc;

  const predSnap = await slateDoc.ref
    .collection(COLLECTIONS.predictions)
    .orderBy("sortOrder", "asc")
    .limit(1)
    .get();

  const predDoc = predSnap.docs[0];
  if (!predDoc) return SAMPLE_SLATE;
  const prediction = predDoc.data() as PredictionDoc;

  return {
    title: slate.title,
    category: slate.category || "Featured",
    // Live pool math arrives with the contest feature; show the sample figure
    // so the tour always demonstrates a populated pool.
    prizePoolCents: SAMPLE_SLATE.prizePoolCents,
    firstPlaceMultiple: SAMPLE_SLATE.firstPlaceMultiple,
    prediction: {
      question: prediction.question,
      optionA: prediction.optionA,
      optionB: prediction.optionB,
      probA: prediction.optionAProbability ?? 50,
      probB: prediction.optionBProbability ?? 50,
    },
  };
}
