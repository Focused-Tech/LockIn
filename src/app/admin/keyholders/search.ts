"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";

/**
 * READ-ONLY lookups for the keyholder admin screen. No write paths live here — role writes go
 * exclusively through the existing setKeyholder/setKeymaster actions. Admin-guarded.
 */

export interface AdminUserRow {
  uid: string;
  username: string;
  keyholder: boolean;
  keymaster: boolean;
  keymasterUid: string | null;
}

async function requireAdmin(): Promise<boolean> {
  const uid = await getCurrentUserId();
  return !!uid && (await isAdminUid(uid));
}

function toRow(id: string, u: UserDoc): AdminUserRow {
  return {
    uid: id,
    username: u.username,
    keyholder: u.keyholder === true,
    keymaster: u.keymaster === true,
    keymasterUid: u.keymasterUid ?? null,
  };
}

/** Prefix search on username (lowercased). Returns up to 20 matches. */
export async function searchUsers(q: string): Promise<AdminUserRow[]> {
  if (!(await requireAdmin())) return [];
  const term = q.trim().toLowerCase();
  if (!term) return [];

  // usernames/{lower} maps lower → { uid }; resolve prefix there, then read the user docs.
  const snap = await adminDb()
    .collection(COLLECTIONS.usernames)
    .orderBy("__name__")
    .startAt(term)
    .endAt(term + "")
    .limit(20)
    .get();

  const uids = snap.docs.map((d) => (d.data() as { uid?: string }).uid).filter((u): u is string => !!u);
  const users = await Promise.all(uids.map((u) => adminDb().collection(COLLECTIONS.users).doc(u).get()));
  return users
    .filter((s) => s.exists)
    .map((s) => toRow(s.id, s.data() as UserDoc));
}

/** The current keymasters — the allowed upline picker options. */
export async function listKeymasters(): Promise<AdminUserRow[]> {
  if (!(await requireAdmin())) return [];
  const snap = await adminDb().collection(COLLECTIONS.users).where("keymaster", "==", true).limit(50).get();
  return snap.docs.map((d) => toRow(d.id, d.data() as UserDoc));
}
