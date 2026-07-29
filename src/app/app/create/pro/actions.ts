"use server";

import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { CATEGORIES } from "@/lib/categories";
import { validateSlate, APPROVED_ARCHETYPES, type Leg, type Archetype } from "@/lib/contest/questionEngine";
import { TONIGHTS_GAMES, enginePlayersFor } from "@/lib/contest/games";
import { notifyFollowersNewSlate } from "@/lib/notifications/send";

const legSchema = z.object({
  question: z.string().trim().min(3).max(200),
  archetype: z.enum(APPROVED_ARCHETYPES as unknown as [Archetype, ...Archetype[]]),
  playerNames: z.array(z.string().trim().min(1)).min(2).max(6),
  context: z.object({
    seasonAverage: z.string().trim().min(1),
    last3Form: z.string().trim().min(1),
    matchupNote: z.string().trim().min(1),
  }),
});

const proSlateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  gameIds: z.array(z.string()).min(2, "Pick at least two games"),
  legs: z.array(legSchema).min(1, "Add at least one question"),
  stakes: z.array(z.number().int().positive()).min(1, "Allow at least one stake"),
  division: z.enum(["hawk", "wolf", "shark", "boss"]),
  targetPotCents: z.number().int().min(0),
  hostFeeCents: z.number().int().min(0).max(1000),
});

export type ProSlateInput = z.infer<typeof proSlateSchema>;
export type ProSlateResult = { ok: true; slateId: string } | { ok: false; error: string };

/** Entry tiers the live engine supports (contest/constants ENTRY_TIERS). Pro "stakes you allow" is a
 *  pot-model concept; the real entry tiers bridge to these. */
const VALID_TIERS = [5, 10, 25] as const;
const sportsCategory = CATEGORIES.find((c) => /sport/i.test(c.name))?.name ?? CATEGORIES[0]!.name;

/**
 * Publish a Creator-mode (slice 4) slate. Re-runs Lockpick (validateSlate) SERVER-SIDE so the
 * one-player-per-game rule can't be bypassed, then persists: the pro config (games/legs/pot) on the
 * slate doc, plus a binary bridge — each cross-game leg becomes a player-A-vs-player-B prediction the
 * existing entry/settlement engine already understands.
 */
export async function publishProSlate(raw: ProSlateInput): Promise<ProSlateResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!profile.creatorVerified) return { ok: false, error: "Apply to become a creator to host contests" };

  const parsed = proSlateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slate" };
  const input = parsed.data;

  // Rebuild the engine legs from the SELECTED games' real rosters and re-validate (Lockpick).
  const byName = new Map(enginePlayersFor(TONIGHTS_GAMES, input.gameIds).map((p) => [p.name, p]));
  const engineLegs: Leg[] = input.legs.map((l) => ({
    archetype: l.archetype,
    players: l.playerNames.map((n) => byName.get(n)).filter((p): p is NonNullable<typeof p> => !!p),
    context: l.context,
  }));
  const { canPublish, legVerdicts } = validateSlate(engineLegs, input.gameIds);
  if (!canPublish) {
    const firstBad = legVerdicts.find((v) => !v.ok);
    return { ok: false, error: firstBad?.message ?? "A question failed Lockpick — fix it and retry." };
  }

  // Entry tiers: the subset of allowed stakes the live engine supports; fall back to $5.
  const tierValues = input.stakes.filter((s): s is (typeof VALID_TIERS)[number] => (VALID_TIERS as readonly number[]).includes(s));
  const tiers = (tierValues.length ? tierValues : [5]).map((tier) => ({ tier, hostingFeeCents: input.hostFeeCents }));

  const uid = profile.id;
  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc();
  const batch = db.batch();

  batch.set(slateRef, {
    creatorId: uid,
    title: input.title,
    description: null,
    category: sportsCategory,
    status: "live",
    entryTiers: tiers,
    entryCount: 0,
    isCardRush: false,
    rushMultiplier: 1,
    maxEntries: null,
    lockTime: Timestamp.fromMillis(Date.now() + 3 * 60 * 60 * 1000), // 3h default window
    promotionOpensAt: FieldValue.serverTimestamp(),
    settledAt: null,
    cancelledAt: null,
    creatorBonusCents: 0,
    createdAt: FieldValue.serverTimestamp(),
    source: "creator_pro",
    // slice-4 pro config — the builder state, for later cross-game play + the pot model.
    proConfig: {
      gameIds: input.gameIds,
      legs: input.legs,
      stakes: input.stakes,
      division: input.division,
      targetPotCents: input.targetPotCents,
      hostFeeCents: input.hostFeeCents,
    },
  });

  // Binary bridge: each leg → a player-A-vs-player-B prediction the current engine can settle.
  input.legs.forEach((l, i) => {
    const predRef = slateRef.collection(COLLECTIONS.predictions).doc();
    batch.set(predRef, {
      question: l.question,
      optionA: l.playerNames[0] ?? "A",
      optionB: l.playerNames[1] ?? "B",
      optionAProbability: 50,
      optionBProbability: 50,
      optionAMultiplier: 2,
      optionBMultiplier: 2,
      predictionType: "binary",
      overUnderLine: null,
      result: null,
      verificationSources: null,
      verificationConfidence: null,
      sortOrder: i,
      // keep the full cross-game leg alongside the bridge for later.
      proLeg: { archetype: l.archetype, playerNames: l.playerNames, context: l.context },
    });
  });

  batch.set(db.collection(COLLECTIONS.users).doc(uid), { isCreator: true }, { merge: true });
  await batch.commit();
  await notifyFollowersNewSlate(db, uid, slateRef.id, input.title, false).catch(() => {});

  return { ok: true, slateId: slateRef.id };
}
