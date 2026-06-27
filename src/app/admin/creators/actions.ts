"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type CreatorApplicationDoc,
} from "@/lib/firebase/types";

export type ReviewResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid || !(await isAdminUid(uid))) return null;
  return uid;
}

/** Approve an application: mark it approved and verify the creator. */
export async function approveCreator(targetUid: string): Promise<ReviewResult> {
  const adminUid = await requireAdmin();
  if (!adminUid) return { ok: false, error: "Not authorized" };

  const db = adminDb();
  const appRef = db.collection(COLLECTIONS.creatorApplications).doc(targetUid);
  const userRef = db.collection(COLLECTIONS.users).doc(targetUid);

  try {
    await db.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) throw new Error("NOT_FOUND");
      const app = appSnap.data() as CreatorApplicationDoc;
      if (app.status === "approved") return; // idempotent

      tx.set(
        appRef,
        {
          status: "approved",
          reviewedBy: adminUid,
          reviewedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.set(
        userRef,
        { creatorVerified: true, isCreator: true },
        { merge: true },
      );
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "NOT_FOUND") return { ok: false, error: "Application not found" };
    return { ok: false, error: "Could not approve" };
  }
  return { ok: true };
}

/**
 * Directly set a user's creator-verified status — works with or without an
 * application doc (used for "approve my own account" and one-click revoke from
 * the admin dashboard). When an application exists, its status is kept in sync.
 */
export async function setCreatorVerified(
  targetUid: string,
  verified: boolean,
): Promise<ReviewResult> {
  const adminUid = await requireAdmin();
  if (!adminUid) return { ok: false, error: "Not authorized" };
  if (!targetUid) return { ok: false, error: "Missing user" };

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(targetUid);
  const appRef = db.collection(COLLECTIONS.creatorApplications).doc(targetUid);

  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) return { ok: false, error: "User not found" };

    await userRef.set(
      { creatorVerified: verified, isCreator: verified },
      { merge: true },
    );

    // Keep any application record consistent with the manual decision.
    const appSnap = await appRef.get();
    if (appSnap.exists) {
      await appRef.set(
        {
          status: verified ? "approved" : "rejected",
          reviewNote: verified ? null : "Access revoked by admin",
          reviewedBy: adminUid,
          reviewedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch {
    return { ok: false, error: "Could not update creator status" };
  }
  return { ok: true };
}

/** Reject an application with a note (shown to the applicant on reapply). */
export async function rejectCreator(
  targetUid: string,
  note: string,
): Promise<ReviewResult> {
  const adminUid = await requireAdmin();
  if (!adminUid) return { ok: false, error: "Not authorized" };

  const trimmed = note.trim();
  if (trimmed.length < 3) return { ok: false, error: "Add a short reason" };

  const appRef = adminDb()
    .collection(COLLECTIONS.creatorApplications)
    .doc(targetUid);
  const snap = await appRef.get();
  if (!snap.exists) return { ok: false, error: "Application not found" };

  await appRef.set(
    {
      status: "rejected",
      reviewNote: trimmed.slice(0, 500),
      reviewedBy: adminUid,
      reviewedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true };
}
