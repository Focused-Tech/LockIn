"use server";

import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type CrossParlayPick,
  type PredictionDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import {
  CROSS_PARLAY_MAX_PICKS,
  CROSS_PARLAY_MIN_PICKS,
  CROSS_PARLAY_MIN_SLATES,
  EXCLUDED_STATES,
  FREE_ENTRY_COIN_COST,
  type EntryTier,
} from "@/lib/constants";
import { parlayMultiplier } from "@/lib/contest/crossParlay";
import { isSelfExcluded } from "@/server/data/responsiblePlay";
import { isSportsCategory } from "@/lib/categories";
import { isMobileClientUA } from "@/lib/mobileClient";

export interface SubmitParlayInput {
  picks: { slateId: string; predictionId: string; pickValue: "a" | "b" }[];
  tier: EntryTier;
  free: boolean;
}

export type SubmitParlayResult =
  | { ok: true; parlayId: string }
  | { ok: false; error: string };

export async function submitCrossParlay(
  input: SubmitParlayInput,
): Promise<SubmitParlayResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (isSelfExcluded(profile)) {
    return { ok: false, error: "Your account is self-excluded — play is paused." };
  }

  const picks = input.picks ?? [];
  if (picks.length < CROSS_PARLAY_MIN_PICKS) {
    return { ok: false, error: `Add at least ${CROSS_PARLAY_MIN_PICKS} picks` };
  }
  if (picks.length > CROSS_PARLAY_MAX_PICKS) {
    return { ok: false, error: `A parlay holds at most ${CROSS_PARLAY_MAX_PICKS} picks` };
  }
  // One pick per prediction; spread across slates.
  const keys = new Set(picks.map((p) => `${p.slateId}:${p.predictionId}`));
  if (keys.size !== picks.length) {
    return { ok: false, error: "Duplicate pick" };
  }
  const slateIds = [...new Set(picks.map((p) => p.slateId))];
  if (slateIds.length < CROSS_PARLAY_MIN_SLATES) {
    return { ok: false, error: "Combine picks from at least 2 different contests" };
  }

  const db = adminDb();
  const now = Date.now();
  const isMobile = isMobileClientUA((await headers()).get("user-agent"));

  // Validate each pick against live, unlocked slates; capture lock times.
  const resolved: CrossParlayPick[] = [];
  for (const p of picks) {
    const slateSnap = await db.collection(COLLECTIONS.slates).doc(p.slateId).get();
    if (!slateSnap.exists) return { ok: false, error: "Contest not found" };
    const slate = slateSnap.data() as SlateDoc;
    const lockMs = slate.lockTime?.toMillis?.() ?? 0;
    if (slate.status !== "live" || lockMs <= now) {
      return { ok: false, error: "A selected contest is no longer open" };
    }
    // STORE COMPLIANCE STRIP — same rule as the single-slate entry (submitEntry): the native app must
    // not accept a CASH leg on a non-sports slate. Checked per-leg since a chain spans multiple slates.
    if (!input.free && !isSportsCategory(slate.category) && isMobile) {
      return { ok: false, error: "This contest isn't offered in the app." };
    }
    const predSnap = await slateSnap.ref
      .collection(COLLECTIONS.predictions)
      .doc(p.predictionId)
      .get();
    if (!predSnap.exists) return { ok: false, error: "Question not found" };
    if (p.pickValue !== "a" && p.pickValue !== "b") {
      return { ok: false, error: "Invalid pick" };
    }
    const pred = predSnap.data() as PredictionDoc;
    resolved.push({
      slateId: p.slateId,
      slateTitle: slate.title,
      predictionId: p.predictionId,
      question: pred.question,
      pickValue: p.pickValue,
      pickLabel: p.pickValue === "a" ? pred.optionA : pred.optionB,
      lockTimeMs: lockMs,
      status: "pending",
    });
  }

  // Paid entries require KYC + an eligible state (same gate as single entries).
  if (!input.free) {
    if (profile.kycStatus !== "verified") {
      return { ok: false, error: "Verify your identity to enter paid contests" };
    }
    if (
      profile.registeredState &&
      (EXCLUDED_STATES as readonly string[]).includes(profile.registeredState)
    ) {
      return { ok: false, error: "Paid contests aren't available in your state" };
    }
  }

  const costCents = input.free ? 0 : input.tier * 100;
  const coinCost = input.free ? FREE_ENTRY_COIN_COST : null;
  const parlayRef = db.collection(COLLECTIONS.crossParlays).doc();
  const userRef = db.collection(COLLECTIONS.users).doc(profile.id);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const user = snap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");

      if (input.free) {
        if (user.coinBalance < FREE_ENTRY_COIN_COST) throw new Error("FUNDS");
        tx.update(userRef, {
          coinBalance: user.coinBalance - FREE_ENTRY_COIN_COST,
        });
      } else {
        if (user.cashBalanceCents < costCents) throw new Error("FUNDS");
        tx.update(userRef, {
          cashBalanceCents: user.cashBalanceCents - costCents,
        });
      }

      tx.set(parlayRef, {
        userId: profile.id,
        picks: resolved,
        slateIds,
        entryTier: input.tier,
        isPaid: !input.free,
        coinCost,
        parlayMultiplier: parlayMultiplier(resolved.length),
        status: "open",
        totalScore: null,
        rank: null,
        payoutCents: null,
        payoutCoins: null,
        refunded: false,
        submittedAt: FieldValue.serverTimestamp(),
        settledAt: null,
      });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "FUNDS") return { ok: false, error: "Insufficient balance" };
    return { ok: false, error: "Could not submit chain" };
  }

  return { ok: true, parlayId: parlayRef.id };
}
