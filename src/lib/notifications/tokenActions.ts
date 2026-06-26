"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

/** Persist a device's push token on the user doc (idempotent via arrayUnion). */
export async function storeDeviceToken(token: string): Promise<{ ok: boolean }> {
  const uid = await getCurrentUserId();
  if (!uid || !token) return { ok: false };
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ deviceTokens: FieldValue.arrayUnion(token) }, { merge: true });
  return { ok: true };
}

/** Remove a device token (e.g. on logout / permission revoked). */
export async function removeDeviceToken(token: string): Promise<{ ok: boolean }> {
  const uid = await getCurrentUserId();
  if (!uid || !token) return { ok: false };
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ deviceTokens: FieldValue.arrayRemove(token) }, { merge: true });
  return { ok: true };
}
