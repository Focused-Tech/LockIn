import "server-only";

/**
 * CREATOR SUGGESTION QUEUE (E) — the reconstructed follower proposals a creator sees on their slate.
 * Server-side (Admin SDK); the collection is never client-readable. Only `reconstructed` proposals
 * surface — abuse-rejected and incompatible suggestions are stored for audit but never shown.
 */
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type QuestionSuggestionDoc } from "@/lib/firebase/types";

export interface SuggestionView {
  id: string;
  rawText: string;
  reconstructedQuestion: string;
  archetype: string;
  suggestedByUsername: string;
  createdAtMs: number;
}

/** Reconstructed proposals for one slate, newest first. Filtered to this creator in memory (one
 *  equality query on slateId → no composite index needed). */
export async function fetchSuggestionQueue(slateId: string, creatorId: string): Promise<SuggestionView[]> {
  const snap = await adminDb().collection(COLLECTIONS.questionSuggestions).where("slateId", "==", slateId).get();
  return snap.docs
    .map((d) => ({ id: d.id, s: d.data() as QuestionSuggestionDoc }))
    .filter(({ s }) => s.creatorId === creatorId && s.status === "reconstructed")
    .map(({ id, s }) => ({
      id,
      rawText: s.rawText,
      reconstructedQuestion: s.reconstructedQuestion ?? "",
      archetype: s.archetype ?? "",
      suggestedByUsername: s.suggestedByUsername,
      createdAtMs: s.createdAt?.toMillis?.() ?? 0,
    }))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}
