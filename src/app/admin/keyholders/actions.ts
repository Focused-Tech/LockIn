"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

/**
 * KEYHOLDER ROLE ADMINISTRATION — ADMIN-ONLY. There is deliberately NO self-serve path to either
 * role: these server actions are the ONLY writers of `keyholder` / `keymaster` / `keymasterUid`, and
 * those fields are absent from the client update whitelist in firestore.rules (so the browser SDK
 * can never set them). The immutable first-touch attribution (`keyholderUid`) is NOT touched here.
 */

export type RoleResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid || !(await isAdminUid(uid))) return null;
  return uid;
}

/**
 * Grant/revoke the keyholder role. When granting, `keymasterUid` records the keyholder's upline
 * keymaster (or null for a top-level keyholder). Revoking also drops keymaster (a non-keyholder
 * cannot be a keymaster).
 */
export async function setKeyholder(
  targetUid: string,
  on: boolean,
  keymasterUid: string | null = null,
): Promise<RoleResult> {
  const adminUid = await requireAdmin();
  if (!adminUid) return { ok: false, error: "Not authorized" };
  if (!targetUid) return { ok: false, error: "Missing user" };
  if (keymasterUid && keymasterUid === targetUid) return { ok: false, error: "A keyholder cannot be their own keymaster" };

  const userRef = adminDb().collection(COLLECTIONS.users).doc(targetUid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) return { ok: false, error: "User not found" };
    await userRef.set(
      on ? { keyholder: true, keymasterUid } : { keyholder: false, keymaster: false },
      { merge: true },
    );
  } catch {
    return { ok: false, error: "Could not update keyholder role" };
  }
  return { ok: true };
}

/**
 * Grant/revoke the keymaster role. Granting also grants keyholder (a keymaster is also a keyholder).
 * Revoking leaves the keyholder role intact.
 */
export async function setKeymaster(targetUid: string, on: boolean): Promise<RoleResult> {
  const adminUid = await requireAdmin();
  if (!adminUid) return { ok: false, error: "Not authorized" };
  if (!targetUid) return { ok: false, error: "Missing user" };

  const userRef = adminDb().collection(COLLECTIONS.users).doc(targetUid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) return { ok: false, error: "User not found" };
    await userRef.set(
      on ? { keymaster: true, keyholder: true } : { keymaster: false },
      { merge: true },
    );
  } catch {
    return { ok: false, error: "Could not update keymaster role" };
  }
  return { ok: true };
}
