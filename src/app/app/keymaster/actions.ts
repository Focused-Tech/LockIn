"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";

/**
 * KEYMASTER ENROLMENT (architect ruling F) — a keymaster may enrol people into THEIR OWN tree, and
 * the ONLY role they can grant is KEYHOLDER. Every limit below is SERVER-ENFORCED here (never relies
 * on the UI): never admin, never keymaster, never poach another keymaster's tree, never revoke
 * outside their own tree. Admin role management stays on /admin/keyholders (separate power).
 */

async function requireKeymaster(): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const snap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  return (snap.data() as UserDoc | undefined)?.keymaster === true ? uid : null;
}

export type EnrolResult = { ok: true } | { ok: false; error: string };

/** Grant KEYHOLDER to a user, into the calling keymaster's tree. Hard-guarded. */
export async function keymasterEnroll(targetUid: string): Promise<EnrolResult> {
  const km = await requireKeymaster();
  if (!km) return { ok: false, error: "Not authorized" };
  if (!targetUid || targetUid === km) return { ok: false, error: "Pick another user" };

  const ref = adminDb().collection(COLLECTIONS.users).doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "User not found" };
  const t = snap.data() as UserDoc;

  // GUARD: never enrol an admin or a keymaster.
  if (t.isAdmin) return { ok: false, error: "Cannot enrol an admin" };
  if (t.keymaster) return { ok: false, error: "Cannot enrol a keymaster" };
  // GUARD: never poach someone already in a DIFFERENT keymaster's tree.
  if (t.keyholder && t.keymasterUid && t.keymasterUid !== km) {
    return { ok: false, error: "Already in another keymaster's tree" };
  }

  // Grants KEYHOLDER ONLY, and pins keymasterUid to ME (my tree). Never sets admin/keymaster.
  await ref.set({ keyholder: true, keymasterUid: km }, { merge: true });
  return { ok: true };
}

/** Revoke KEYHOLDER — ONLY for a member of the calling keymaster's own tree. */
export async function keymasterRevoke(targetUid: string): Promise<EnrolResult> {
  const km = await requireKeymaster();
  if (!km) return { ok: false, error: "Not authorized" };

  const ref = adminDb().collection(COLLECTIONS.users).doc(targetUid);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "User not found" };
  const t = snap.data() as UserDoc;

  // GUARD: only within MY tree; never touch a keymaster/admin.
  if (t.keymasterUid !== km) return { ok: false, error: "Not in your tree" };
  if (t.keymaster || t.isAdmin) return { ok: false, error: "Cannot revoke that role" };

  await ref.set({ keyholder: false, keymasterUid: null }, { merge: true });
  return { ok: true };
}

export interface KmSearchRow {
  uid: string;
  username: string;
  keyholder: boolean;
  inMyTree: boolean;
}

/** Read-only username search for the enrolment picker (keymaster-gated). */
export async function keymasterSearch(q: string): Promise<KmSearchRow[]> {
  const km = await requireKeymaster();
  if (!km) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];

  const db = adminDb();
  const snap = await db
    .collection(COLLECTIONS.usernames)
    .orderBy("__name__")
    .startAt(term)
    .endAt(term + "")
    .limit(20)
    .get();
  const uids = snap.docs.map((d) => (d.data() as { uid?: string }).uid).filter((u): u is string => !!u);
  const users = await Promise.all(uids.map((u) => db.collection(COLLECTIONS.users).doc(u).get()));
  return users
    .filter((s) => s.exists)
    .map((s) => {
      const u = s.data() as UserDoc;
      return { uid: s.id, username: u.username, keyholder: u.keyholder === true, inMyTree: u.keymasterUid === km };
    });
}
