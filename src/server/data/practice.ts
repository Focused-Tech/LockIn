import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type PracticeContestDoc,
  type PracticeEntryDoc,
  type PracticeLeg,
} from "@/lib/firebase/types";
import { rankForCoins, type RankInfo } from "@/lib/practice/tiers";
import { PRACTICE_START_COINS } from "@/lib/practice/scoring";

export interface PracticeHostedRow {
  id: string;
  title: string;
  category: string;
  inviteCode: string;
  status: string;
  entryCount: number;
}

export interface PracticeHome {
  practiceCoins: number;
  lifetimeCoins: number;
  streak: number;
  rank: RankInfo;
  hosted: PracticeHostedRow[];
}

/** Practice home: rank/coins/streak + the contests this user hosts. */
export async function fetchPracticeHome(
  db: Firestore,
  uid: string,
  user: { practiceCoins?: number; practiceLifetimeCoins?: number; practiceStreak?: number },
): Promise<PracticeHome> {
  const snap = await db
    .collection(COLLECTIONS.practiceContests)
    .where("hostId", "==", uid)
    .get();
  const hosted: PracticeHostedRow[] = snap.docs
    .map((d) => {
      const c = d.data() as PracticeContestDoc;
      return {
        id: d.id,
        title: c.title,
        category: c.category,
        inviteCode: c.inviteCode,
        status: c.status,
        entryCount: c.entryCount ?? 0,
        createdAtMs: (c.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0,
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map(({ createdAtMs: _drop, ...row }) => row);

  return {
    practiceCoins: user.practiceCoins ?? PRACTICE_START_COINS,
    lifetimeCoins: user.practiceLifetimeCoins ?? 0,
    streak: user.practiceStreak ?? 0,
    rank: rankForCoins(user.practiceLifetimeCoins ?? 0),
    hosted,
  };
}

export interface PracticeLeaderRow {
  userId: string;
  username: string;
  tier: string;
  score: number;
  correct: number;
  netCoins: number;
  won: boolean;
}

export interface PracticeContestView {
  id: string;
  hostUsername: string;
  title: string;
  category: string;
  inviteCode: string;
  status: string;
  mode: string;
  tier: string;
  stakeCoins: number;
  legs: PracticeLeg[];
  entryCount: number;
  /** The current user's own entry, if they've played. */
  myEntry: {
    picks: ("a" | "b")[];
    correct: number;
    netCoins: number;
    won: boolean;
  } | null;
  /** Outcomes + per-leg results — ONLY present once the user has played. */
  reveal: { outcomes: ("a" | "b")[]; hits: boolean[] } | null;
  leaderboard: PracticeLeaderRow[];
}

/**
 * A practice contest shaped for a player. Hidden outcomes are included ONLY when
 * the requesting user has already submitted (they've earned the reveal); other
 * players never receive the outcomes before they play.
 */
export async function fetchPracticeContest(
  db: Firestore,
  contestId: string,
  uid: string,
): Promise<PracticeContestView | null> {
  const ref = db.collection(COLLECTIONS.practiceContests).doc(contestId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = snap.data() as PracticeContestDoc;

  const [mineSnap, entriesSnap] = await Promise.all([
    ref.collection(COLLECTIONS.entries).doc(uid).get(),
    ref.collection(COLLECTIONS.entries).get(),
  ]);

  const mine = mineSnap.exists ? (mineSnap.data() as PracticeEntryDoc) : null;

  const leaderboard: PracticeLeaderRow[] = entriesSnap.docs
    .map((d) => d.data() as PracticeEntryDoc)
    .map((e) => ({
      userId: e.userId,
      username: e.username,
      tier: e.tier,
      score: e.score,
      correct: e.correct,
      netCoins: e.netCoins,
      won: e.won,
    }))
    .sort((a, b) => b.score - a.score || b.netCoins - a.netCoins);

  return {
    id: snap.id,
    hostUsername: c.hostUsername,
    title: c.title,
    category: c.category,
    inviteCode: c.inviteCode,
    status: c.status,
    mode: c.mode,
    tier: c.tier,
    stakeCoins: c.stakeCoins,
    legs: c.legs, // no outcome field on PracticeLeg
    entryCount: c.entryCount ?? 0,
    myEntry: mine
      ? { picks: mine.picks, correct: mine.correct, netCoins: mine.netCoins, won: mine.won }
      : null,
    reveal: mine
      ? {
          outcomes: c.outcomes,
          hits: c.outcomes.map((o, i) => mine.picks[i] === o),
        }
      : null,
    leaderboard,
  };
}

/** Resolve a 6-char invite code to its contest id (for join-by-code). */
export async function resolveInviteCode(
  db: Firestore,
  code: string,
): Promise<string | null> {
  const snap = await db
    .collection(COLLECTIONS.practiceContests)
    .where("inviteCode", "==", code.trim().toUpperCase())
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0]!.id;
}
