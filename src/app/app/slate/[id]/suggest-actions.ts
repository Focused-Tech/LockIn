"use server";

/**
 * FOLLOWER SUGGESTIONS (E) — server actions. A follower submits a plain-language idea; it is
 * moderated (same abuse gate as creator text), then reconstructed by the Locksmith into a compliant
 * proposal that lands in the CREATOR's queue. A follower can never publish. The creator accepts or
 * dismisses. Every suggestion is stored server-side with who suggested it and which slate (E.f).
 */
import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type SlateDoc } from "@/lib/firebase/types";
import { moderateCreatorFields } from "@/lib/moderation/creatorContent";
import { reconstructSuggestion } from "@/lib/locksmith/reconstruct";
import { domainForCategory } from "@/lib/subcategories/domain";

export type SubmitSuggestionResult =
  | { ok: true; question: string; archetype: string }
  | { ok: false; error: string };

export async function submitSuggestion(slateId: string, rawText: string): Promise<SubmitSuggestionResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Sign in to suggest a question." };
  const text = (rawText ?? "").trim();
  if (text.length < 6) return { ok: false, error: "Add a few words describing your question." };
  if (text.length > 300) return { ok: false, error: "Keep it under 300 characters." };

  const db = adminDb();
  const slateSnap = await db.collection(COLLECTIONS.slates).doc(slateId).get();
  if (!slateSnap.exists) return { ok: false, error: "Contest not found." };
  const slate = slateSnap.data() as SlateDoc;
  const creatorId = slate.creatorId;
  if (!creatorId) return { ok: false, error: "This contest doesn't take suggestions." };
  if (creatorId === profile.id) return { ok: false, error: "You host this contest — add questions in the builder." };

  const base = {
    slateId,
    creatorId,
    suggestedByUid: profile.id,
    suggestedByUsername: profile.username ?? "someone",
    rawText: text,
    reconstructedQuestion: null as string | null,
    archetype: null as string | null,
    note: null as string | null,
    createdAt: FieldValue.serverTimestamp(),
    reviewedAt: null,
  };
  const ref = db.collection(COLLECTIONS.questionSuggestions).doc();

  // 1) same abuse moderation as creator text (E.d) — BEFORE a creator ever sees it.
  const mod = await moderateCreatorFields([{ label: "Suggestion", value: text }]);
  if (!mod.ok) {
    await ref.set({ ...base, status: "rejected_abuse", note: mod.failures[0]?.category ?? "abuse" });
    return { ok: false, error: "That suggestion can't be sent — it contains content we don't allow." };
  }

  // 2) Locksmith reconstruction → nearest archetype + approved voice (structural guards inside).
  const domain = domainForCategory(slate.category);
  const recon = await reconstructSuggestion({ rawText: text, domain, category: slate.category });
  if (!recon.compatible || !recon.question || !recon.archetype) {
    await ref.set({ ...base, status: "rejected_incompatible", note: recon.reason ?? "incompatible" });
    return { ok: false, error: "The Locksmith couldn't turn that into an allowed question. Try a comparison between two people on the show." };
  }

  // 3) lands in the CREATOR's queue as a proposal (E.c) — the creator decides.
  await ref.set({ ...base, status: "reconstructed", reconstructedQuestion: recon.question, archetype: recon.archetype });
  revalidatePath(`/app/slate/${slateId}`);
  return { ok: true, question: recon.question, archetype: recon.archetype };
}

/** Creator-only: accept (keep as a proposal to build) or dismiss a reconstructed suggestion. */
export async function resolveSuggestion(slateId: string, suggestionId: string, action: "accept" | "dismiss"): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const ref = adminDb().collection(COLLECTIONS.questionSuggestions).doc(suggestionId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "Not found" };
  const s = snap.data() as { creatorId: string; slateId: string };
  if (s.creatorId !== profile.id || s.slateId !== slateId) return { ok: false, error: "Not your queue" };
  await ref.set({ status: action === "accept" ? "accepted" : "dismissed", reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  revalidatePath(`/app/slate/${slateId}`);
  return { ok: true };
}
