"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type PracticeContestDoc,
  type PracticeEntryDoc,
  type PracticeLeg,
  type UserDoc,
} from "@/lib/firebase/types";
import { generateSlate } from "@/lib/ai/aiEngine";
import { CATEGORIES } from "@/lib/categories";
import {
  difficultyForTier,
  rankForCoins,
  type PracticeTierKey,
} from "@/lib/practice/tiers";
import {
  PRACTICE_DEFAULT_STAKE,
  PRACTICE_RECENT_WINDOW,
  PRACTICE_REFILL_THRESHOLD,
  PRACTICE_REFILL_TO,
  PRACTICE_START_COINS,
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
};

export type CreatePracticeResult =
  | { ok: true; contestId: string; inviteCode: string }
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

  const category =
    CATEGORIES.find((c) => c.name === input.category)?.name ??
    input.category.slice(0, 40);
  const rank = rankForCoins(profile.practiceLifetimeCoins ?? 0);
  const tierKey = rank.tier.key as PracticeTierKey;
  const difficulty = difficultyForTier(
    tierKey,
    recentWinRate(profile.practiceRecent),
  );

  let legs: PracticeLeg[];
  let title: string;

  if (input.mode === "manual") {
    const raw = (input.manualLegs ?? []).filter(
      (l) => l.question.trim() && l.optionA.trim() && l.optionB.trim(),
    );
    if (raw.length < 2) {
      return { ok: false, error: "Add at least 2 legs" };
    }
    legs = raw.slice(0, 8).map((l, i) => {
      const probA = clampProb(l.probA);
      return {
        id: `m${i}`,
        question: l.question.trim().slice(0, 200),
        optionA: l.optionA.trim().slice(0, 60),
        optionB: l.optionB.trim().slice(0, 60),
        probA,
        probB: 100 - probA,
        type: "binary",
        line: null,
        difficulty: "medium",
      };
    });
    title = `${category} practice`;
  } else {
    try {
      const topic = `${input.topic?.trim() || `${category} practice slate`}. Difficulty: ${difficulty.lineStyle}`;
      const slate = await generateSlate({ topic, legCount: difficulty.legs });
      if (!slate.legs.length) return { ok: false, error: "AI returned no legs" };
      legs = slate.legs.map((leg, i) => ({
        id: `g${i}`,
        question: leg.question,
        optionA: leg.optionA,
        optionB: leg.optionB,
        probA: leg.probA,
        probB: leg.probB,
        type: leg.type,
        line: leg.overUnderLine,
        difficulty: leg.difficulty,
      }));
      title = `${slate.category || category} practice`;
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "AI_NOT_CONFIGURED") {
        return { ok: false, error: "AI is not configured — try manual legs" };
      }
      return { ok: false, error: "Could not generate a slate — try again" };
    }
  }

  // Roll hidden outcomes weighted by each leg's probability (favorite likelier).
  const outcomes: Choice[] = legs.map((l) =>
    Math.random() * 100 < l.probA ? "a" : "b",
  );

  const ref = adminDb().collection(COLLECTIONS.practiceContests).doc();
  const doc: PracticeContestDoc = {
    hostId: profile.id,
    hostUsername: profile.username,
    title,
    category,
    inviteCode: randCode(),
    status: "open",
    mode: input.mode,
    tier: tierKey,
    stakeCoins: PRACTICE_DEFAULT_STAKE,
    legs,
    outcomes,
    entryCount: 0,
    createdAt: FieldValue.serverTimestamp() as never,
  };
  await ref.set(doc);
  return { ok: true, contestId: ref.id, inviteCode: doc.inviteCode };
}

export type SubmitPracticeResult =
  | {
      ok: true;
      correct: number;
      legs: number;
      net: number;
      won: boolean;
      perfect: boolean;
      message: string;
      hits: boolean[];
      outcomes: Choice[];
      newBalance: number;
      streak: number;
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

  if (picks.length !== contest.legs.length || picks.some((p) => p !== "a" && p !== "b")) {
    return { ok: false, error: "Make a pick on every leg" };
  }

  const entryRef = contestRef.collection(COLLECTIONS.entries).doc(profile.id);
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
      const balance = practiceBalance(user);
      if (balance < stake) throw new Error("LOW_COINS");

      const r = scorePractice(picks, contest.outcomes, stake);
      const recent = [...(user.practiceRecent ?? []), r.won].slice(
        -PRACTICE_RECENT_WINDOW,
      );
      const streak = r.won ? (user.practiceStreak ?? 0) + 1 : 0;
      const lifetimeAdd = Math.max(0, r.creditedCoins); // titles only ever go up

      tx.set(
        userRef,
        {
          practiceCoins: balance - stake + r.creditedCoins,
          practiceLifetimeCoins: (user.practiceLifetimeCoins ?? 0) + lifetimeAdd,
          practiceStreak: streak,
          practiceRecent: recent,
        },
        { merge: true },
      );

      const entry: PracticeEntryDoc = {
        userId: profile.id,
        username: profile.username,
        tier: rankForCoins(user.practiceLifetimeCoins ?? 0).tier.key,
        picks,
        correct: r.correct,
        score: r.correct,
        netCoins: r.net,
        won: r.won,
        submittedAt: FieldValue.serverTimestamp() as never,
      };
      tx.set(entryRef, entry);
      tx.update(contestRef, { entryCount: FieldValue.increment(1) });

      return { r, streak, newBalance: balance - stake + r.creditedCoins };
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "ALREADY_ENTERED")
      return { ok: false, error: "You already played this contest" };
    if (m === "LOW_COINS")
      return { ok: false, error: "Not enough practice coins — refill first" };
    return { ok: false, error: "Could not submit your picks" };
  }

  const { r, streak, newBalance } = result;
  return {
    ok: true,
    correct: r.correct,
    legs: r.legs,
    net: r.net,
    won: r.won,
    perfect: r.perfect,
    message: r.message,
    hits: r.hits,
    outcomes: contest.outcomes,
    newBalance,
    streak,
  };
}

/** Free refill when busted — keeps the practice loop from hard-stopping. */
export async function refillPractice(): Promise<{ ok: boolean; balance: number }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, balance: 0 };
  const balance = practiceBalance(profile);
  if (balance > PRACTICE_REFILL_THRESHOLD) return { ok: true, balance };
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(profile.id)
    .set({ practiceCoins: PRACTICE_REFILL_TO }, { merge: true });
  return { ok: true, balance: PRACTICE_REFILL_TO };
}
