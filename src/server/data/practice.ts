import "server-only";
import { unstable_cache } from "next/cache";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type PracticeContestDoc,
  type PracticeEntryDoc,
  type PracticeLeg,
} from "@/lib/firebase/types";
import { rankForCoins, type RankInfo } from "@/lib/practice/tiers";
import { PRACTICE_START_COINS } from "@/lib/practice/scoring";
import { getAiCreator } from "@/lib/practice/creators";

/** Cache tags (bust on writes — see practice actions). */
export const PRACTICE_HOSTED_TAG = "practice-hosted";
export const PRACTICE_CONTEST_TAG = "practice-contest";

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

/**
 * The contests a given user hosts — the only repeatable query behind the arena
 * home. Cached per-uid (short revalidate, busted on host) so repeat loads skip
 * the Firestore round-trip. Mirrors the Explore feed cache: shared/repeatable
 * read cached; live/private state reconciled by the page (rank/coins come from
 * the already-loaded user doc, not from here).
 */
async function fetchHostedContests(uid: string): Promise<PracticeHostedRow[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.practiceContests)
    .where("hostId", "==", uid)
    .get();
  return snap.docs
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
}

const fetchHostedContestsCached = unstable_cache(
  (uid: string) => fetchHostedContests(uid),
  ["practice-hosted-contests"],
  { revalidate: 30, tags: [PRACTICE_HOSTED_TAG] },
);

/** Practice home: rank/coins/streak (from the user doc) + cached hosted list. */
export async function fetchPracticeHome(
  uid: string,
  user: { practiceCoins?: number; practiceLifetimeCoins?: number; practiceStreak?: number },
): Promise<PracticeHome> {
  const hosted = await fetchHostedContestsCached(uid);

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
  /** Present when an AI-simulated creator hosts this slate (honest labeling). */
  aiCreator: {
    name: string;
    handle: string;
    avatar: string;
    persona: string;
    styleNote: string;
    accent: string;
  } | null;
  title: string;
  category: string;
  inviteCode: string;
  status: string;
  mode: string;
  tier: string;
  stakeCoins: number;
  legs: PracticeLeg[];
  /** Countdown + spot-race window (epoch ms), or null when not running. */
  urgency: { startAt: number; lockAt: number } | null;
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
 * SHARED contest core — identical for every viewer: the contest doc (title,
 * legs, host, urgency window) + the full leaderboard. Includes the hidden
 * `outcomes` (SERVER-ONLY; this cache lives in server memory and outcomes only
 * ever reach a client via `reveal`, after they've played). Cached per-contest
 * with a short revalidate so the leaderboard N-read isn't re-run every request.
 */
interface PracticeContestCore {
  id: string;
  hostUsername: string;
  aiCreator: PracticeContestView["aiCreator"];
  title: string;
  category: string;
  inviteCode: string;
  status: string;
  mode: string;
  tier: string;
  stakeCoins: number;
  legs: PracticeLeg[];
  urgency: { startAt: number; lockAt: number } | null;
  entryCount: number;
  outcomes: ("a" | "b")[];
  leaderboard: PracticeLeaderRow[];
}

async function fetchPracticeContestCore(
  contestId: string,
): Promise<PracticeContestCore | null> {
  const ref = adminDb().collection(COLLECTIONS.practiceContests).doc(contestId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = snap.data() as PracticeContestDoc;

  const entriesSnap = await ref.collection(COLLECTIONS.practiceEntries).get();
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

  const creator = c.aiCreatorId ? getAiCreator(c.aiCreatorId) : undefined;

  return {
    id: snap.id,
    hostUsername: c.hostUsername,
    aiCreator: creator
      ? {
          name: creator.name,
          handle: creator.handle,
          avatar: creator.avatar,
          persona: creator.persona,
          styleNote: creator.styleNote,
          accent: creator.accent,
        }
      : null,
    title: c.title,
    category: c.category,
    inviteCode: c.inviteCode,
    status: c.status,
    mode: c.mode,
    tier: c.tier,
    stakeCoins: c.stakeCoins,
    legs: c.legs, // no outcome field on PracticeLeg
    urgency:
      c.urgencyStartAt != null && c.urgencyLockAt != null
        ? { startAt: c.urgencyStartAt, lockAt: c.urgencyLockAt }
        : null,
    entryCount: c.entryCount ?? 0,
    outcomes: c.outcomes,
    leaderboard,
  };
}

const fetchPracticeContestCoreCached = unstable_cache(
  (contestId: string) => fetchPracticeContestCore(contestId),
  ["practice-contest-core"],
  { revalidate: 15, tags: [PRACTICE_CONTEST_TAG] },
);

/**
 * A practice contest shaped for a player. The shared core (doc + leaderboard) is
 * cached; the requesting user's OWN entry is fetched fresh (uncached) so it's
 * never cross-contaminated between users. Hidden outcomes are surfaced ONLY via
 * `reveal`, and only once this user has submitted (they've earned the reveal).
 */
export async function fetchPracticeContest(
  db: Firestore,
  contestId: string,
  uid: string,
): Promise<PracticeContestView | null> {
  const core = await fetchPracticeContestCoreCached(contestId);
  if (!core) return null;

  const mineSnap = await db
    .collection(COLLECTIONS.practiceContests)
    .doc(contestId)
    .collection(COLLECTIONS.practiceEntries)
    .doc(uid)
    .get();
  const mine = mineSnap.exists ? (mineSnap.data() as PracticeEntryDoc) : null;

  const { outcomes, ...shared } = core;
  return {
    ...shared,
    myEntry: mine
      ? { picks: mine.picks, correct: mine.correct, netCoins: mine.netCoins, won: mine.won }
      : null,
    reveal: mine
      ? {
          outcomes,
          hits: outcomes.map((o, i) => mine.picks[i] === o),
        }
      : null,
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
