"use server";

import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { CATEGORIES } from "@/lib/categories";
import { validateSlate, APPROVED_ARCHETYPES, type Leg, type Archetype } from "@/lib/contest/questionEngine";
import { enginePlayersFor, earliestStartMs } from "@/lib/contest/games";
import { getTodaysCreatorGames, getPlayerContext, type PlayerContext } from "@/server/feeds/creatorGames";
import { notifyFollowersNewSlate } from "@/lib/notifications/send";

/** §1.2 — season average + last-out form for a leg's players, from the live feed (a batch, on
 *  demand when the creator picks players — never per keystroke). */
export async function fetchLegContext(playerIds: string[]): Promise<PlayerContext[]> {
  try {
    return await getPlayerContext(playerIds);
  } catch (err) {
    console.error("[creator] player context fetch failed", err);
    return [];
  }
}

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

/** §2.1 — the pickable options for a leg, per archetype:
 *  - top-composite (h2h/field/biggest) + first-to-N: one option per player
 *  - split-squad duos: two duos ("A"/"B"), the roster split in half
 *  - milestone count: exact-count buckets 0..K (how many players clear the bar) */
function deriveProOptions(archetype: string, players: string[]): { key: string; playerNames?: string[]; bucket?: [number, number] }[] {
  if (archetype === "split_squad_duos") {
    const mid = Math.ceil(players.length / 2);
    return [
      { key: "A", playerNames: players.slice(0, mid) },
      { key: "B", playerNames: players.slice(mid) },
    ];
  }
  if (archetype === "milestone_count") {
    return Array.from({ length: players.length + 1 }, (_, c) => ({ key: String(c), bucket: [c, c] as [number, number] }));
  }
  return players.map((n) => ({ key: n, playerNames: [n] }));
}

/** Entry tiers the live engine supports (contest/constants ENTRY_TIERS). Pro "stakes you allow" is a
 *  pot-model concept; the real entry tiers bridge to these. */
const VALID_TIERS = [5, 10, 25] as const;
const sportsCategory = CATEGORIES.find((c) => /sport/i.test(c.name))?.name ?? CATEGORIES[0]!.name;

/**
 * Publish a Creator-mode slate. Re-runs Lockpick (validateSlate) SERVER-SIDE against the LIVE rosters
 * so one-player-per-game can't be bypassed, then persists: the pro config on the slate doc + one
 * ARCHETYPE prediction per leg carrying its N options (§2.1 — no binary A/B bridge). Slate close is
 * the earliest tip among the chosen games (§1.E).
 */
export async function publishProSlate(raw: ProSlateInput): Promise<ProSlateResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!profile.creatorVerified) return { ok: false, error: "Apply to become a creator to host contests" };

  const parsed = proSlateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slate" };
  const input = parsed.data;

  // §1.1 — rebuild the engine legs from the LIVE rosters of the selected games (no seed) and
  // re-validate (Lockpick). §1.E — slate close is the earliest tip among the chosen games.
  const games = await getTodaysCreatorGames();
  const startMs = earliestStartMs(games, input.gameIds);
  if (startMs == null) return { ok: false, error: "Those games aren't on the live board anymore — reload and pick from tonight's games." };
  const byName = new Map(enginePlayersFor(games, input.gameIds).map((p) => [p.name, p]));
  const idByName = new Map(games.flatMap((g) => g.players).map((p) => [p.name, p.playerId ?? ""]));
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
    lockTime: Timestamp.fromMillis(startMs), // §1.E — closes at the first tip, before the event starts
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

  // §2.1 — each leg is an ARCHETYPE prediction carrying its N options (no binary A/B bridge). The
  // options the entry picks from depend on the archetype (players / duos / count buckets).
  input.legs.forEach((l, i) => {
    const predRef = slateRef.collection(COLLECTIONS.predictions).doc();
    const options = deriveProOptions(l.archetype, l.playerNames);
    const isMilestone = l.archetype === "milestone_count";
    batch.set(predRef, {
      question: l.question,
      optionA: null,
      optionB: null,
      optionAProbability: null,
      optionBProbability: null,
      optionAMultiplier: null,
      optionBMultiplier: null,
      predictionType: "archetype",
      overUnderLine: null,
      result: null,
      verificationSources: null,
      verificationConfidence: null,
      sortOrder: i,
      archetype: l.archetype,
      proOptions: options,
      // name → gameId for this leg, so one-player-per-game can be RE-checked at entry (§2.3).
      playerGames: Object.fromEntries(l.playerNames.map((n) => [n, byName.get(n)?.gameId ?? ""])),
      // name → ESPN athlete id, so the picker can pull each player's context at play time (§1.2).
      playerIds: Object.fromEntries(l.playerNames.map((n) => [n, idByName.get(n) ?? ""])),
      // first-to-N / milestone need a bar; the builder does not author one yet → null (settlement
      // voids those legs until a bar is supplied). context is display-only.
      bar: null,
      countedPlayers: isMilestone ? l.playerNames : null,
      context: l.context,
    });
  });

  batch.set(db.collection(COLLECTIONS.users).doc(uid), { isCreator: true }, { merge: true });
  await batch.commit();
  await notifyFollowersNewSlate(db, uid, slateRef.id, input.title, false).catch(() => {});

  return { ok: true, slateId: slateRef.id };
}
