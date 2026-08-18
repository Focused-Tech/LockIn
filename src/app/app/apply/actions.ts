"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type CreatorApplicationDoc } from "@/lib/firebase/types";
import { CATEGORIES } from "@/lib/categories";

const schema = z.object({
  audienceUrl: z.string().trim().url("Add a valid channel link").max(300),
  audienceSize: z.number().int().min(0).max(1_000_000_000),
  categories: z.array(z.string()).min(1, "Pick at least one category").max(20),
  pitch: z
    .string()
    .trim()
    .min(20, "Tell us a bit more (at least 20 characters)")
    .max(1000),
});

export type ApplyInput = z.infer<typeof schema>;
export type ApplyResult = { ok: true } | { ok: false; error: string };

export async function submitCreatorApplication(
  raw: ApplyInput,
): Promise<ApplyResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (profile.creatorVerified) {
    return { ok: false, error: "You're already an approved creator" };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid application",
    };
  }
  const input = parsed.data;

  const valid = new Set(CATEGORIES.map((c) => c.name));
  if (!input.categories.every((c) => valid.has(c))) {
    return { ok: false, error: "Unknown category" };
  }

  const ref = adminDb()
    .collection(COLLECTIONS.creatorApplications)
    .doc(profile.id);
  const existing = await ref.get();
  if (existing.exists) {
    const status = (existing.data() as CreatorApplicationDoc).status;
    if (status === "pending") {
      return { ok: false, error: "Your application is already under review" };
    }
    if (status === "approved") {
      return { ok: false, error: "You're already an approved creator" };
    }
  }

  await ref.set({
    userId: profile.id,
    username: profile.username,
    audienceUrl: input.audienceUrl,
    audienceSize: input.audienceSize,
    categories: input.categories,
    pitch: input.pitch,
    status: "pending",
    reviewNote: null,
    reviewedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
  });

  return { ok: true };
}
