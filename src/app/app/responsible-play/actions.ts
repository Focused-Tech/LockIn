"use server";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import {
  DEPOSIT_LIMITS,
  PERMANENT_EXCLUSION_MS,
  SELF_EXCLUSION_PERIODS,
  type SelfExclusionKey,
} from "@/lib/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

const clamp = (v: number, max: number) => Math.max(0, Math.min(Math.round(v), max));

/**
 * Update deposit limits. Limits may only move DOWN — each is clamped to its
 * regulatory cap, and daily ≤ weekly ≤ monthly is enforced.
 */
export async function updateDepositLimits(input: {
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}): Promise<ActionResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const monthly = clamp(input.monthlyCents, DEPOSIT_LIMITS.monthlyCents);
  const weekly = Math.min(clamp(input.weeklyCents, DEPOSIT_LIMITS.weeklyCents), monthly);
  const daily = Math.min(clamp(input.dailyCents, DEPOSIT_LIMITS.dailyCents), weekly);

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        depositLimitDailyCents: daily,
        depositLimitWeeklyCents: weekly,
        depositLimitMonthlyCents: monthly,
      },
      { merge: true },
    );

  return { ok: true };
}

/**
 * Self-exclude for a period. Self-exclusion can only be EXTENDED, never
 * shortened or lifted early — the new end is max(current, requested).
 */
export async function setSelfExclusion(
  key: SelfExclusionKey,
): Promise<ActionResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const period = SELF_EXCLUSION_PERIODS.find((p) => p.key === key);
  if (!period) return { ok: false, error: "Invalid period" };

  const requestedUntilMs =
    period.ms === null ? PERMANENT_EXCLUSION_MS : Date.now() + period.ms;

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.get();
  const user = snap.data() as UserDoc | undefined;
  const currentMs = user?.selfExclusionUntil?.toMillis?.() ?? 0;

  const untilMs = Math.max(currentMs, requestedUntilMs);
  await userRef.set(
    { selfExclusionUntil: Timestamp.fromMillis(untilMs) },
    { merge: true },
  );

  return { ok: true };
}
