import "server-only";
import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "./admin";
import { SESSION_COOKIE } from "./config";
import { COLLECTIONS, type UserDoc } from "./types";

/**
 * Verify the current request's Firebase session cookie.
 * Returns the decoded token, or null when unauthenticated/expired.
 *
 * `checkRevoked` is true so disabled/revoked sessions are rejected server-side.
 */
export async function getCurrentUser(): Promise<DecodedIdToken | null> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    return await adminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

/** The authenticated user's uid, or null. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.uid ?? null;
}

/** Platform admins, from the comma-separated ADMIN_UIDS env. */
export function isAdminUid(uid: string): boolean {
  return (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(uid);
}

/** Load the authenticated user's Firestore profile, or null. */
export async function getCurrentUserProfile(): Promise<
  (UserDoc & { id: string }) | null
> {
  const uid = await getCurrentUserId();
  if (!uid) return null;

  const snap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as UserDoc) };
}
