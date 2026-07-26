"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import type { FoxPitRoomKey } from "@/lib/foxpit";
import type { FoxPitCategory } from "@/lib/foxpit/rules";
import type { TriviaQuestion } from "@/lib/foxpit/trivia";
import { triviaLabelsForCategory } from "@/lib/foxpit/trivia";
import {
  cardsByCategory,
  buildSlatesFromPool,
  questionsPerSlate,
  type FoxSlate,
} from "@/lib/foxpit/slates";
import { fetchTriviaForRound } from "@/server/foxpit/triviaStore";

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

/**
 * Deal a Fox Pit round from the never-repeat MC pool. For each chosen tower category we fetch exactly
 * `cards × questionsPerSlate` FRESH (unseen) questions — fetchTriviaForRound marks them seen at deal,
 * so a question never repeats for this player — then group them into slates. Returns serializable
 * FoxSlate[] (MC). A dry pool yields fewer cards rather than a repeat; an empty result is surfaced.
 */
export async function dealFoxRound(
  room: FoxPitRoomKey,
  chosen: FoxPitCategory[],
  count: number,
): Promise<{ ok: boolean; slates?: FoxSlate[]; error?: string }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };
  try {
    const db = adminDb();
    const qPer = questionsPerSlate(room);
    const demand = cardsByCategory(chosen, count);
    const poolByCategory: Record<string, TriviaQuestion[]> = {};
    for (const [cat, cards] of Object.entries(demand)) {
      const labels = triviaLabelsForCategory(cat);
      if (!labels.length) continue;
      poolByCategory[cat] = await fetchTriviaForRound(db, uid, room, labels, cards * qPer);
    }
    const slates = buildSlatesFromPool(room, chosen, count, poolByCategory);
    if (slates.length === 0) {
      return { ok: false, error: "No fresh questions left for those categories — pick others or regenerate the pool." };
    }
    return { ok: true, slates };
  } catch (err) {
    console.error("[foxpit] dealFoxRound failed", err);
    return { ok: false, error: "Couldn't deal this round. Try again." };
  }
}
