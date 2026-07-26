"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";

/** Sanity clamp on a single Fox Pit round's coin swing (coins, not cash — zero rake). Rejects a
 *  client-reported delta beyond this so a tampered client can't mint coins. */
const MAX_ROUND_SWING = 2000;

/**
 * Apply a Fox Pit tower round's NET coin result to the player's coin wallet. The tower is a
 * self-contained COIN economy (no cash, zero rake); until now its stakes/winnings were illustrative
 * and never touched `users/{uid}.coinBalance`. This persists them: the delta is clamped, applied in a
 * transaction, and the balance is floored at 0. Returns the new balance so the client can update live.
 */
export async function applyFoxPitCoins(delta: number): Promise<{ ok: boolean; newBalance?: number }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false };

  const d = Math.trunc(delta);
  if (!Number.isFinite(d) || Math.abs(d) > MAX_ROUND_SWING) {
    console.error(`[foxpit] rejected coin delta ${delta} (outside ±${MAX_ROUND_SWING})`);
    return { ok: false };
  }
  if (d === 0) {
    const snap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
    return { ok: true, newBalance: (snap.data() as UserDoc | undefined)?.coinBalance ?? 0 };
  }

  const ref = adminDb().collection(COLLECTIONS.users).doc(uid);
  try {
    const newBalance = await adminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = (snap.data() as UserDoc | undefined)?.coinBalance ?? 0;
      const next = Math.max(0, cur + d);
      tx.update(ref, { coinBalance: next, foxpitCoinsUpdatedAt: FieldValue.serverTimestamp() });
      return next;
    });
    return { ok: true, newBalance };
  } catch (err) {
    console.error("[foxpit] applyFoxPitCoins transaction failed", err);
    return { ok: false };
  }
}
