"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import {
  PRACTICE_CONTEST_TAG,
  PRACTICE_HOSTED_TAG,
} from "@/server/data/practice";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type PracticeContestDoc,
  type PracticeEntryDoc,
  type PracticeLeg,
  type UserDoc,
} from "@/lib/firebase/types";
import { buildPracticeSlate } from "@/lib/practice/generate";
import { CATEGORIES } from "@/lib/categories";
import { getAiCreator } from "@/lib/practice/creators";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { resolveSpot } from "@/lib/practice/urgency";
import {
  difficultyForTier,
  rankForCoins,
  type PracticeTierKey,
} from "@/lib/practice/tiers";
import {
  claimRefill,
  PRACTICE_DEFAULT_STAKE,
  PRACTICE_RECENT_WINDOW,
  PRACTICE_START_COINS,
  scheduledRefillAt,
  scorePractice,
  type Choice,
} from "@/lib/practice/scoring";

/** Lazy practice balance (users predating practice mode default to 500). */
function practiceBalance(u: Pick<UserDoc, "practiceCoins">): number {
  return u.practiceCoins ?? PRACTICE_START_COINS;
}

function recentWinRate(recent: boolean[] | undefined): number | undefined {
  if (!recent || recent.length === 0) return undefined;
  const w = recent.filter(Boolean).length;
  return w / recent.length;
}

const clampProb = (p: number) => Math.max(1, Math.min(99, Math.round(p)));
/** Coerce a stored outcome/pick to an option index — legacy docs stored "a"/"b". */
const asIndex = (v: number | string): number =>
  typeof v === "number" ? v : v === "b" ? 1 : 0;
const randCode = () =>
  Array.from({ length: 6 }, () =>
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 31)),
  ).join("");

interface ManualLeg {
  question: string;
  optionA: string;
  optionB: string;
  probA: number;
}

export type CreatePracticeInput = {
  category: string;
  mode: "ai" | "manual";
  topic?: string;
  manualLegs?: ManualLeg[];
  /** When set to a known `ai_*` id, the slate is hosted by that AI creator and
   *  generated in their style (always AI mode). */
  creatorId?: string;
};

export type CreatePracticeResult =
  | {
      ok: true;
      contestId: string;
      inviteCode: string;
      /** The generated/host legs — so a client that just created this contest can
       *  render the pick surface without a second round-trip (used by the Arena's
       *  sequential play). Never carries the hidden outcomes. */
      legs: PracticeLeg[];
      /** Countdown + spot-race window for the fresh contest, or null if disabled. */
      urgency: { startAt: number; lockAt: number } | null;
      stakeCoins: number;
    }
  | { ok: false; error: string };

/**
 * Host a multiplayer PRACTICE contest (play-money). AI mode uses the same engine
 * (SLATE_MODEL) as the real creator journey; manual mode takes the host's legs.
 * Per-leg outcomes are rolled here (weighted by each leg's probability) and kept
 * server-only for instant settlement when players submit.
 */
export async function createPracticeContest(
  input: CreatePracticeInput,
): Promise<CreatePracticeResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };

  // An AI creator hosts in their own style (always AI mode); steer the category
  // to one they actually cover.
  const creator = input.creatorId ? getAiCreator(input.creatorId) : undefined;
  let category =
    CATEGORIES.find((c) => c.name === input.category)?.name ??
    input.category.slice(0, 40);
  if (creator && !creator.categories.includes(category)) {
    category = creator.categories[0]!;
  }
  const rank = rankForCoins(profile.practiceLifetimeCoins ?? 0);
  const tierKey = rank.tier.key as PracticeTierKey;
  const difficulty = difficultyForTier(
    tierKey,
    recentWinRate(profile.practiceRecent),
  );

  let legs: PracticeLeg[];
  let outcomes: Choice[];
  let title: string;

  // A creator forces AI mode (they host engine-built slates in their style).
  const mode: "ai" | "manual" = creator ? "ai" : input.mode;

  if (mode === "manual") {
    const raw = (input.manualLegs ?? []).filter(
      (l) => l.question.trim() && l.optionA.trim() && l.optionB.trim(),
    );
    if (raw.length < 2) {
      return { ok: false, error: "Add at least 2 legs" };
    }
    // Host-authored legs are two-option; wrap them in the N-option shape with empty
    // per-option context (a manual leg has no game/roster to draw context from).
    const emptyCtx = { gameLine: "", seasonAvg: "", lastOut: "" };
    legs = raw.slice(0, 8).map((l, i) => {
      const probA = clampProb(l.probA);
      return {
        id: `m${i}`,
        question: l.question.trim().slice(0, 200),
        options: [
          { label: l.optionA.trim().slice(0, 60), prob: probA, context: emptyCtx },
          { label: l.optionB.trim().slice(0, 60), prob: 100 - probA, context: emptyCtx },
        ],
        archetype: "manual",
        difficulty: "medium" as const,
      };
    });
    // Roll each leg's hidden outcome weighted by option 0's consensus %.
    outcomes = legs.map((l) => (Math.random() * 100 < l.options[0]!.prob ? 0 : 1));
    title = `${category} practice`;
  } else {
    // AI/creator mode: draw N-option legs from the shared ARCHETYPE LIBRARY (the same
    // source the feed uses) — with hidden outcomes pre-rolled by consensus.
    const built = buildPracticeSlate(category, difficulty.legs);
    if (!built.legs.length) return { ok: false, error: "Could not generate a slate — try again" };
    legs = built.legs;
    outcomes = built.outcomes;
    title = creator
      ? `${creator.name}'s ${category} slate`
      : `${category} practice`;
  }

  // Start the urgency countdown at creation (fresh slates are played immediately).
  const nowMs = Date.now();
  const urgency = PRACTICE_CONFIG.urgency.enabled
    ? {
        urgencyStartAt: nowMs,
        urgencyLockAt: nowMs + PRACTICE_CONFIG.urgency.countdownMs,
      }
    : {};

  const ref = adminDb().collection(COLLECTIONS.practiceContests).doc();
  const doc: PracticeContestDoc = {
    hostId: creator ? creator.id : profile.id,
    hostUsername: creator ? creator.handle : profile.username,
    title,
    category,
    inviteCode: randCode(),
    status: "open",
    mode,
    tier: tierKey,
    stakeCoins: PRACTICE_DEFAULT_STAKE,
    legs,
    outcomes,
    entryCount: 0,
    ...(creator ? { aiCreatorId: creator.id } : {}),
    ...urgency,
    createdAt: FieldValue.serverTimestamp() as never,
  };
  await ref.set(doc);
  // New contest → the host's cached "Your contests" list is stale.
  revalidateTag(PRACTICE_HOSTED_TAG);
  return {
    ok: true,
    contestId: ref.id,
    inviteCode: doc.inviteCode,
    legs,
    urgency: PRACTICE_CONFIG.urgency.enabled
      ? { startAt: nowMs, lockAt: nowMs + PRACTICE_CONFIG.urgency.countdownMs }
      : null,
    stakeCoins: doc.stakeCoins,
  };
}

export type SubmitPracticeResult =
  | {
      ok: true;
      correct: number;
      legs: number;
      net: number;
      won: boolean;
      perfect: boolean;
      nearMiss: boolean;
      message: string;
      hits: boolean[];
      outcomes: Choice[];
      newBalance: number;
      streak: number;
      /** True when this entry crossed into a higher rank tier. */
      tierUp: boolean;
      newTierKey: string;
      newTierLabel: string;
      /** Spot race: the top spot (1–3) the player claimed, or null if all gone. */
      spot: number | null;
      /** How many top spots were already filled by mocks at submit time. */
      spotsFilled: number;
      /** Winnings multiplier applied for the claimed spot (1.0 if none). */
      spotBonus: number;
    }
  | { ok: false; error: string };

/**
 * Join-and-settle: a player submits picks for a practice contest and is scored
 * INSTANTLY against the hidden outcomes. Debits the stake + credits the result
 * to the player's PRACTICE balance (score only) in one transaction, updates
 * streak / lifetime / recent window, and writes the leaderboard entry.
 */
export async function submitPracticePicks(
  contestId: string,
  picks: Choice[],
): Promise<SubmitPracticeResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };

  const db = adminDb();
  const contestRef = db.collection(COLLECTIONS.practiceContests).doc(contestId);
  const contestSnap = await contestRef.get();
  if (!contestSnap.exists) return { ok: false, error: "Contest not found" };
  const contest = contestSnap.data() as PracticeContestDoc;
  // Normalize outcomes to indexes (legacy contests stored "a"/"b").
  const outcomes = (contest.outcomes as (number | string)[]).map(asIndex);

  // Each pick is an option INDEX within its leg's option list.
  const validPicks =
    picks.length === contest.legs.length &&
    picks.every(
      (p, i) =>
        Number.isInteger(p) &&
        p >= 0 &&
        p < (contest.legs[i]?.options.length ?? 0),
    );
  if (!validPicks) {
    return { ok: false, error: "Make a pick on every leg" };
  }

  const entryRef = contestRef.collection(COLLECTIONS.practiceEntries).doc(profile.id);
  const userRef = db.collection(COLLECTIONS.users).doc(profile.id);

  let result;
  try {
    result = await db.runTransaction(async (tx) => {
      const [entrySnap, userSnap] = await Promise.all([
        tx.get(entryRef),
        tx.get(userRef),
      ]);
      if (entrySnap.exists) throw new Error("ALREADY_ENTERED");
      const user = userSnap.data() as UserDoc;

      const stake = contest.stakeCoins;
      const now = Date.now();
      // Auto-claim the free daily refill if the cooldown has elapsed.
      const claim = claimRefill(
        practiceBalance(user),
        user.practiceRefillAt ?? null,
        now,
      );
      if (claim.coins < stake) throw new Error("BUSTED"); // wait for the daily refill

      // Spot race: how many premium spots remain at this instant decides which
      // spot the player claims and how much their winnings are boosted (SCORE).
      const spotRes =
        contest.urgencyStartAt != null && contest.urgencyLockAt != null
          ? resolveSpot(contest.urgencyStartAt, contest.urgencyLockAt, now)
          : { spot: null, filled: 0, bonus: 1 };

      const r = scorePractice(picks, outcomes, stake, spotRes.bonus);
      const recent = [...(user.practiceRecent ?? []), r.won].slice(
        -PRACTICE_RECENT_WINDOW,
      );
      const streak = r.won ? (user.practiceStreak ?? 0) + 1 : 0;
      const beforeLifetime = user.practiceLifetimeCoins ?? 0;
      const afterLifetime = beforeLifetime + Math.max(0, r.creditedCoins);
      const newBalance = claim.coins - stake + r.creditedCoins;
      const refillAt = scheduledRefillAt(newBalance, claim.refillAt, now);

      const rankBefore = rankForCoins(beforeLifetime);
      const rankAfter = rankForCoins(afterLifetime);

      tx.set(
        userRef,
        {
          practiceCoins: newBalance,
          practiceLifetimeCoins: afterLifetime,
          practiceStreak: streak,
          practiceRecent: recent,
          practiceRefillAt: refillAt,
        },
        { merge: true },
      );

      const entry: PracticeEntryDoc = {
        userId: profile.id,
        username: profile.username,
        tier: rankAfter.tier.key,
        picks,
        correct: r.correct,
        score: r.correct,
        netCoins: r.net,
        won: r.won,
        submittedAt: FieldValue.serverTimestamp() as never,
      };
      tx.set(entryRef, entry);
      tx.update(contestRef, { entryCount: FieldValue.increment(1) });

      return {
        r,
        streak,
        newBalance,
        tierUp: rankAfter.index > rankBefore.index,
        newTier: rankAfter.tier,
        spotRes,
      };
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "ALREADY_ENTERED")
      return { ok: false, error: "You already played this contest" };
    if (m === "BUSTED")
      return { ok: false, error: "Out of practice coins — your free refill arrives tomorrow." };
    return { ok: false, error: "Could not submit your picks" };
  }

  // New entry → the contest's cached leaderboard + entry count are stale.
  revalidateTag(PRACTICE_CONTEST_TAG);

  const { r, streak, newBalance, tierUp, newTier, spotRes } = result;
  return {
    ok: true,
    correct: r.correct,
    legs: r.legs,
    net: r.net,
    won: r.won,
    perfect: r.perfect,
    nearMiss: !r.perfect && r.correct === r.legs - 1,
    message: r.message,
    hits: r.hits,
    outcomes,
    newBalance,
    streak,
    tierUp,
    newTierKey: newTier.key,
    newTierLabel: newTier.label,
    spot: spotRes.spot,
    spotsFilled: spotRes.filled,
    spotBonus: spotRes.bonus,
  };
}

/**
 * Persist the coin delta from client-scored ARENA (parlay) slates — the LOCAL
 * fallback used when the AI engine can't generate a slate. Those slates are
 * scored client-side and never reach {@link submitPracticePicks}, so their net
 * would otherwise be lost. Real slates in the same round already persisted
 * during play, so ONLY the local portion is passed here. Applies the net to the
 * player's PRACTICE balance the same way the rest of the economy does (Firestore
 * user doc, transactional), clamped at 0. Returns the new balance.
 */
export async function applyPracticeArenaNet(
  netDelta: number,
): Promise<{ ok: boolean; balance: number }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, balance: 0 };

  const delta = Math.round(netDelta);
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: true, balance: practiceBalance(profile) };
  }

  const userRef = adminDb().collection(COLLECTIONS.users).doc(profile.id);
  const balance = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const user = (snap.data() as UserDoc | undefined) ?? ({} as UserDoc);
    const after = Math.max(0, practiceBalance(user) + delta);
    tx.set(
      userRef,
      {
        practiceCoins: after,
        // Lifetime tracks gross winnings (drives rank/difficulty) — only gains.
        practiceLifetimeCoins:
          (user.practiceLifetimeCoins ?? 0) + Math.max(0, delta),
      },
      { merge: true },
    );
    return after;
  });

  return { ok: true, balance };
}

/**
 * Claim the FREE DAILY refill (not instant): only tops up to 500 once the
 * busted player's cooldown has elapsed. Never sells coins for real money.
 * Returns the (possibly unchanged) balance + the next refill time for the UI.
 */
export async function refillPractice(): Promise<{
  balance: number;
  refillAt: number | null;
  refilled: boolean;
}> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { balance: 0, refillAt: null, refilled: false };
  const claim = claimRefill(
    practiceBalance(profile),
    profile.practiceRefillAt ?? null,
    Date.now(),
  );
  if (claim.refilled) {
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(profile.id)
      .set({ practiceCoins: claim.coins, practiceRefillAt: null }, { merge: true });
  }
  return {
    balance: claim.coins,
    refillAt: claim.refillAt,
    refilled: claim.refilled,
  };
}

/**
 * Follow / unfollow an AI-SIMULATED creator (training opponent). Stored on the
 * user doc in `followedAiCreators`, kept separate from real-creator follows.
 * Returns the new follow state. Play-money only — grants nothing of value.
 */
export async function toggleFollowAiCreator(
  creatorId: string,
): Promise<{ ok: true; following: boolean } | { ok: false; error: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!getAiCreator(creatorId)) return { ok: false, error: "Unknown creator" };

  const current = new Set(profile.followedAiCreators ?? []);
  const following = !current.has(creatorId);

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(profile.id)
    .set(
      {
        followedAiCreators: following
          ? FieldValue.arrayUnion(creatorId)
          : FieldValue.arrayRemove(creatorId),
      },
      { merge: true },
    );

  return { ok: true, following };
}
