"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

/** Persist tour progress on the user doc (Admin SDK, server-only). */
export async function saveTourState(input: {
  step?: number;
  completed?: boolean;
}): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;

  const data: Record<string, unknown> = {};
  if (typeof input.step === "number") data.currentTourStep = input.step;
  if (input.completed) data.hasCompletedTour = true;
  if (Object.keys(data).length === 0) return;

  await adminDb().collection(COLLECTIONS.users).doc(uid).set(data, { merge: true });
}
