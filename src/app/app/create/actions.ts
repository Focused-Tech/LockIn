"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { CATEGORIES } from "@/lib/categories";
import { getJurisdiction, evaluatePaidEntry } from "@/lib/eligibility";
import { isMobile, isCashSportsCategory } from "@/lib/surface";
import { suggestOddsMock, type OddsSuggestion } from "@/lib/ai/probability";
import { notifyFollowersNewSlate } from "@/lib/notifications/send";
import { detectBannedArchetype } from "@/lib/contest/questionEngine";
import { moderateCreatorFields, firstModerationError } from "@/lib/moderation/creatorContent";

/** Mock AI odds — swapped for real data-driven estimation later. */
export async function suggestOdds(input: {
  question: string;
  optionA: string;
  optionB: string;
}): Promise<OddsSuggestion> {
  return suggestOddsMock(input);
}

const categoryNames = CATEGORIES.map((c) => c.name);

const predictionSchema = z.object({
  type: z.enum(["binary", "over_under"]),
  question: z.string().trim().min(3, "Add a question").max(200),
  optionA: z.string().trim().min(1).max(60),
  optionB: z.string().trim().min(1).max(60),
  line: z.number().nullable(),
  probA: z.number().min(1).max(99),
  probB: z.number().min(1).max(99),
});

const tierSchema = z.object({
  tier: z.union([z.literal(5), z.literal(10), z.literal(25)]),
  hostingFeeCents: z.number().int().min(0).max(1000),
});

const createSlateSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().refine((c) => categoryNames.includes(c), {
    message: "Pick a category",
  }),
  lockTimeMs: z
    .number()
    .refine((ms) => ms > Date.now(), { message: "Lock time must be in the future" }),
  predictions: z.array(predictionSchema).min(1, "Add at least one prediction").max(10),
  tiers: z.array(tierSchema).min(1, "Offer at least one entry tier"),
  cardRush: z.boolean().default(false),
  rushMultiplier: z.union([z.literal(2), z.literal(3)]).optional(),
  maxEntries: z.number().int().positive().max(1_000_000).nullable().optional(),
});

export type CreateSlateInput = z.infer<typeof createSlateSchema>;
export type CreateSlateResult =
  | { ok: true; slateId: string }
  | { ok: false; error: string };

const mult = (prob: number) => Math.round((100 / prob) * 100) / 100;

/**
 * Create a live slate + its predictions, authored by the current user. Hosting
 * is gated on an approved creator application (`creatorVerified`). Over/under
 * questions get "Over/Under {line}" option labels.
 */
export async function createSlate(
  raw: CreateSlateInput,
): Promise<CreateSlateResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!profile.creatorVerified) {
    return { ok: false, error: "Apply to become a creator to host contests" };
  }
  // Creator-side cash gate — hosting exposes LockIn to the same jurisdiction/age/KYC risk as playing,
  // so it is held to the SAME real-money gate as submitEntry, not a separate, looser one.
  const jurisdictionKey = getJurisdiction(await headers());
  const gate = evaluatePaidEntry({ user: profile, jurisdictionKey });
  if (!gate.allowed) {
    return { ok: false, error: gate.message };
  }
  const uid = profile.id;

  const parsed = createSlateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slate" };
  }
  const input = parsed.data;

  // Unique tiers only.
  const tierKeys = new Set(input.tiers.map((t) => t.tier));
  if (tierKeys.size !== input.tiers.length) {
    return { ok: false, error: "Duplicate entry tier" };
  }

  // SURFACE GATE, WRITE SIDE — every slate here carries at least one paid tier (the schema requires
  // it), so hosting IS cash hosting. Fail closed on a non-cash-sports category from the mobile
  // surface: hiding it from the feed isn't enough if a creator could still publish it from the app.
  if (!isCashSportsCategory(input.category) && isMobile()) {
    return { ok: false, error: "This category isn't available to host from the app." };
  }
  // COMPLIANCE — reject any banned archetype before publish: team/game outcome, spread, combined
  // total, over/under, or a single-athlete numeric threshold. Over/under is banned outright.
  for (const p of input.predictions) {
    if (p.type === "over_under" || detectBannedArchetype(p.question, [p.optionA, p.optionB])) {
      return { ok: false, error: "That question isn't allowed — no team outcomes, spreads, or over/unders. Use an approved cross-game question." };
    }
  }

  // ABUSE MODERATION (Part 3) — runs AFTER the compliance-shape check above, BEFORE any write.
  // "Allowed shape?" (validateLeg/detectBannedArchetype) and "acceptable content?" (this) are
  // different gates; BOTH must pass. Failure names the field + is never a silent rewrite.
  const moderation = await moderateCreatorFields([
    { label: "Title", value: input.title },
    ...(input.description ? [{ label: "Description", value: input.description }] : []),
    ...input.predictions.flatMap((p, i) => [
      { label: `Question ${i + 1}`, value: p.question },
      { label: `Question ${i + 1} · Option A`, value: p.optionA },
      { label: `Question ${i + 1} · Option B`, value: p.optionB },
    ]),
  ]);
  if (!moderation.ok) {
    return { ok: false, error: firstModerationError(moderation) ?? "That content isn't allowed." };
  }

  if (input.cardRush && !input.rushMultiplier) {
    return { ok: false, error: "Pick a Card Rush multiplier (2x or 3x)" };
  }
  const isCardRush = input.cardRush;
  const rushMultiplier = isCardRush ? (input.rushMultiplier ?? 2) : 1;
  const maxEntries = isCardRush ? (input.maxEntries ?? null) : null;

  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc();
  const batch = db.batch();

  batch.set(slateRef, {
    creatorId: uid,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    status: "live",
    entryTiers: input.tiers,
    entryCount: 0,
    isCardRush,
    rushMultiplier,
    maxEntries,
    lockTime: Timestamp.fromMillis(input.lockTimeMs),
    promotionOpensAt: FieldValue.serverTimestamp(),
    settledAt: null,
    cancelledAt: null,
    creatorBonusCents: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  input.predictions.forEach((p, i) => {
    const predRef = slateRef.collection(COLLECTIONS.predictions).doc();
    batch.set(predRef, {
      question: p.question,
      optionA: p.optionA,
      optionB: p.optionB,
      optionAProbability: p.probA,
      optionBProbability: p.probB,
      optionAMultiplier: mult(p.probA),
      optionBMultiplier: mult(p.probB),
      predictionType: p.type,
      overUnderLine: p.line,
      result: null,
      verificationSources: null,
      verificationConfidence: null,
      sortOrder: i,
    });
  });

  batch.set(
    db.collection(COLLECTIONS.users).doc(uid),
    { isCreator: true },
    { merge: true },
  );

  await batch.commit();

  // Push: alert this creator's followers about the new contest / Card Rush.
  await notifyFollowersNewSlate(
    db,
    uid,
    slateRef.id,
    input.title,
    isCardRush,
  ).catch(() => {});

  return { ok: true, slateId: slateRef.id };
}
