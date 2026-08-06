"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type TutorialDoc } from "@/lib/firebase/types";
import {
  TUTORIAL_VERSION,
  TUTORIAL_MODES,
  type TutorialMode,
  type TutorialRecord,
} from "@/lib/tutorial/tutorials";

function isMode(m: string): m is TutorialMode {
  return (TUTORIAL_MODES as readonly string[]).includes(m);
}

/**
 * Read the per-mode tutorial record (server, Admin SDK). Shape mirrors the creator agreement
 * signature: one doc per mode, carrying the version so a bump re-offers it.
 */
export async function getTutorialRecord(
  mode: string,
): Promise<TutorialRecord | null> {
  if (!isMode(mode)) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const snap = await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.tutorials)
    .doc(mode)
    .get();
  if (!snap.exists) return null;
  const d = snap.data() as TutorialDoc;
  return {
    mode,
    version: d.version,
    seen: d.seen === true,
    seenAt: undefined,
  };
}

/**
 * Mark a mode's tutorial SEEN at the current version (skip or complete both call this — §4: skip is
 * honoured permanently for that mode). Idempotent per mode; a later version bump overwrites with the
 * new version, re-offering it once.
 */
export async function markTutorialSeen(
  mode: string,
): Promise<{ ok: boolean }> {
  if (!isMode(mode)) return { ok: false };
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false };
  const doc: TutorialDoc = {
    mode,
    version: TUTORIAL_VERSION,
    seen: true,
    seenAt: FieldValue.serverTimestamp(),
  };
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.tutorials)
    .doc(mode)
    .set(doc, { merge: true });
  return { ok: true };
}
