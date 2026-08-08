"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { recordDivisionAck } from "@/server/data/championship";
import { TRIGGER_CARD_IDS, type TriggerCardId } from "@/lib/championship/triggers";

/**
 * Mark a Championship trigger card seen — the once-only seen-record (tutorials precedent). Writing
 * the record is what guarantees the card never fires again. For the division-change card we also
 * advance the recorded division so the next observation is measured from here.
 */
export async function markChampionshipCardSeen(
  cardId: TriggerCardId,
  currentDivision?: string,
): Promise<{ ok: boolean }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false };
  if (!TRIGGER_CARD_IDS.includes(cardId)) return { ok: false };

  const db = adminDb();
  await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.championshipCards)
    .doc(cardId)
    .set({ cardId, seen: true, seenAt: FieldValue.serverTimestamp() }, { merge: true });

  if (cardId === "division_change" && currentDivision) {
    await recordDivisionAck(db, uid, currentDivision).catch(() => {});
  }
  return { ok: true };
}
