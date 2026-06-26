"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type BeginnerEntryLeg,
  type JourneyLane,
  type PredictionDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import { isSelfExcluded } from "@/server/data/responsiblePlay";
import { MAX_LEGS, winUpTo } from "@/lib/beginner/payoutModel";

/** Persist the user's chosen Explore lane (onboarding choice or in-feed toggle). */
export async function setJourneyLane(lane: JourneyLane): Promise<{ ok: boolean }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false };
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ journeyLane: lane }, { merge: true });
  return { ok: true };
}

/** A leg as submitted by the client (labels are re-derived server-side). */
interface LockLegInput {
  slateId: string;
  predictionId: string;
  choice: "a" | "b";
}

type LockBeginnerEntryInput = {
  creatorId: string | null;
  stakeCoins: number;
  legs: LockLegInput[];
};

type LockBeginnerEntryResult =
  | { ok: true; entryId: string; newBalance: number; winUpToCoins: number }
  | { ok: false; error: string };

/**
 * Lock a beginner entry: validate the legs against REAL live slates/predictions,
 * then atomically debit the coin stake and persist the entry. Settlement is NOT
 * performed (out of scope) — `winUpToCoins` is the illustrative tunable
 * projection captured at lock time, not a settled payout.
 */
export async function lockBeginnerEntry(
  input: LockBeginnerEntryInput,
): Promise<LockBeginnerEntryResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const stake = Math.trunc(input.stakeCoins);
  if (!Number.isFinite(stake) || stake <= 0)
    return { ok: false, error: "Choose how many coins to play" };

  if (input.legs.length < 1 || input.legs.length > MAX_LEGS)
    return { ok: false, error: `Pick between 1 and ${MAX_LEGS} calls` };
  const seen = new Set<string>();
  for (const leg of input.legs) {
    if (leg.choice !== "a" && leg.choice !== "b")
      return { ok: false, error: "Invalid pick" };
    if (seen.has(leg.predictionId))
      return { ok: false, error: "Duplicate pick in your combo" };
    seen.add(leg.predictionId);
  }

  const db = adminDb();

  // Validate each leg against the real slate + prediction, deriving labels
  // server-side (don't trust client-supplied display text).
  const resolved: BeginnerEntryLeg[] = [];
  for (const leg of input.legs) {
    const slateSnap = await db
      .collection(COLLECTIONS.slates)
      .doc(leg.slateId)
      .get();
    if (!slateSnap.exists) return { ok: false, error: "Contest not found" };
    const slate = slateSnap.data() as SlateDoc;
    if (slate.status !== "live" || slate.lockTime.toMillis() <= Date.now())
      return { ok: false, error: "One of these contests has closed" };

    const predSnap = await slateSnap.ref
      .collection(COLLECTIONS.predictions)
      .doc(leg.predictionId)
      .get();
    if (!predSnap.exists) return { ok: false, error: "Pick not found" };
    const pred = predSnap.data() as PredictionDoc;

    resolved.push({
      slateId: leg.slateId,
      predictionId: leg.predictionId,
      choice: leg.choice,
      question: pred.question,
      pickLabel: leg.choice === "a" ? pred.optionA : pred.optionB,
    });
  }

  const winUpToCoins = winUpTo(stake, resolved.length);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const entryRef = db.collection(COLLECTIONS.beginnerEntries).doc();

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const user = userSnap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");
      if (isSelfExcluded(user)) throw new Error("EXCLUDED");
      if (user.coinBalance < stake) throw new Error("LOW_COINS");

      tx.update(userRef, { coinBalance: FieldValue.increment(-stake) });
      tx.set(entryRef, {
        userId: uid,
        creatorId: input.creatorId,
        legs: resolved,
        stakeCoins: stake,
        winUpToCoins,
        settled: false,
        submittedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "LOW_COINS")
      return { ok: false, error: "Not enough coins for that stake" };
    if (m === "EXCLUDED")
      return { ok: false, error: "Your account is self-excluded. Play is paused." };
    return { ok: false, error: "Could not lock in your entry" };
  }

  // Read back the post-debit balance for the UI (best-effort).
  const after = (await userRef.get()).data() as UserDoc | undefined;
  return {
    ok: true,
    entryId: entryRef.id,
    newBalance: after?.coinBalance ?? 0,
    winUpToCoins,
  };
}
