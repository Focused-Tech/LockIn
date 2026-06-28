"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { resolveInviteCode } from "@/server/data/practice";

/** Resolve a friend's invite code to a contest id (play-money practice). */
export async function resolveAndGo(
  code: string,
): Promise<{ ok: true; contestId: string } | { ok: false; error: string }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 4) return { ok: false, error: "Enter the full code" };
  const contestId = await resolveInviteCode(adminDb(), trimmed);
  if (!contestId) return { ok: false, error: "No contest for that code" };
  return { ok: true, contestId };
}
