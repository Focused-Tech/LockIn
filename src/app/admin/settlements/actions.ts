"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import { COLLECTIONS, type SlateDoc } from "@/lib/firebase/types";
import { settleSlate } from "@/server/settlement/settle";

export type ResolveResult =
  | { ok: true; settled: number }
  | { ok: false; error: string };

/**
 * Manually resolve a `pending_review` slate: stamp each prediction's result from
 * the admin's picks, then run settlement (which now finds every outcome resolved
 * and pays out). Every prediction must be picked, or it would re-route to review.
 */
export async function resolveSlate(
  slateId: string,
  picks: Record<string, "a" | "b">,
): Promise<ResolveResult> {
  const uid = await getCurrentUserId();
  if (!uid || !isAdminUid(uid)) return { ok: false, error: "Not authorized" };

  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc(slateId);
  const slateSnap = await slateRef.get();
  if (!slateSnap.exists) return { ok: false, error: "Slate not found" };
  if ((slateSnap.data() as SlateDoc).status !== "pending_review") {
    return { ok: false, error: "Slate is not awaiting review" };
  }

  const predsSnap = await slateRef.collection(COLLECTIONS.predictions).get();
  const missing = predsSnap.docs.some((d) => {
    const pick = picks[d.id];
    return pick !== "a" && pick !== "b";
  });
  if (missing) return { ok: false, error: "Pick an outcome for every question" };

  const batch = db.batch();
  for (const d of predsSnap.docs) {
    batch.set(d.ref, { result: picks[d.id] }, { merge: true });
  }
  await batch.commit();

  const result = await settleSlate(slateId);
  if (!result.ok) return { ok: false, error: result.error };
  if (result.pendingReview) {
    return { ok: false, error: "Still unresolved — check every question" };
  }
  return { ok: true, settled: result.settled };
}
