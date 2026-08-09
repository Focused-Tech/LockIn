"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";

/**
 * KEYHOLDER → REQUEST PLACEMENT. A keyholder cannot enrol anyone or make keys — their ONLY tree
 * action is to REQUEST placement in a keymaster's downline (the keymaster then approves). Guarded:
 * caller must be a keyholder; target must be a keymaster; a keyholder already in a tree can't move
 * (placement is once — attribution immutability).
 */
export type RequestResult = { ok: true } | { ok: false; error: string };

export async function requestPlacement(keymasterCode: string): Promise<RequestResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const db = adminDb();
  const meSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const me = meSnap.data() as UserDoc | undefined;
  if (!me || me.keyholder !== true) return { ok: false, error: "Only keyholders can request placement" };
  if (me.keymasterUid) return { ok: false, error: "You're already in a keymaster's tree" };

  // Resolve the keymaster by their code (= username) → uid, and confirm they're a keymaster.
  const code = keymasterCode.trim().toLowerCase();
  if (!code) return { ok: false, error: "Enter a keymaster code" };
  const nameSnap = await db.collection(COLLECTIONS.usernames).doc(code).get();
  const kmUid = nameSnap.exists ? (nameSnap.data() as { uid?: string }).uid : undefined;
  if (!kmUid || kmUid === uid) return { ok: false, error: "No keymaster found with that code" };
  const kmSnap = await db.collection(COLLECTIONS.users).doc(kmUid).get();
  const km = kmSnap.data() as UserDoc | undefined;
  if (!km || km.keymaster !== true) return { ok: false, error: "No keymaster found with that code" };

  await db.collection(COLLECTIONS.downlineRequests).doc(uid).set({
    keyholderUid: uid,
    keyholderUsername: me.username,
    keymasterUid: kmUid,
    keymasterUsername: km.username,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    resolvedAt: null,
  });
  return { ok: true };
}

/** The keyholder's own current request (to show its status), or null. */
export async function myPlacementRequest(): Promise<{ keymasterUsername: string; status: string } | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const snap = await adminDb().collection(COLLECTIONS.downlineRequests).doc(uid).get();
  if (!snap.exists) return null;
  const r = snap.data() as { keymasterUsername: string; status: string };
  return { keymasterUsername: r.keymasterUsername, status: r.status };
}
