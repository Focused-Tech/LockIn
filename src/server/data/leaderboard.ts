import "server-only";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type EntryDoc,
  type UserDoc,
} from "@/lib/firebase/types";

export type LeaderboardWindow = "today" | "week" | "all";

export interface LeaderRow {
  rank: number;
  userId: string;
  username: string;
  totalWonCents: number;
  wins: number;
  plays: number;
  /** Win rate as a whole percentage. */
  winRate: number;
  /** Current trailing win streak. */
  streak: number;
  isCurrentUser: boolean;
  /** Whether this user is an active LockIn Pro subscriber. */
  isPro: boolean;
}

export interface LeaderboardData {
  window: LeaderboardWindow;
  rows: LeaderRow[];
  /** The current user's row, only when they fall outside the top list. */
  currentUserRow: LeaderRow | null;
}

/** Cap the scan; aggregates should be precomputed at real scale. */
const SCAN_LIMIT = 5000;
const TOP = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Agg {
  userId: string;
  plays: number;
  wins: number;
  totalWonCents: number;
  timeline: { ms: number; win: boolean }[];
}

function windowStartMs(window: LeaderboardWindow): number {
  const now = Date.now();
  if (window === "today") {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if (window === "week") return now - 7 * DAY_MS;
  return 0;
}

/** Current streak = leading wins when the user's entries are newest-first. */
function computeStreak(timeline: Agg["timeline"]): number {
  const sorted = [...timeline].sort((a, b) => b.ms - a.ms);
  let streak = 0;
  for (const t of sorted) {
    if (!t.win) break;
    streak += 1;
  }
  return streak;
}

interface UserInfo {
  username: string;
  isPro: boolean;
}

async function fetchUserInfo(
  db: Firestore,
  ids: string[],
): Promise<Map<string, UserInfo>> {
  const map = new Map<string, UserInfo>();
  if (ids.length === 0) return map;
  const refs = ids.map((id) => db.collection(COLLECTIONS.users).doc(id));
  const snaps = await db.getAll(...refs);
  for (const s of snaps) {
    const u = s.data() as UserDoc | undefined;
    if (u) map.set(s.id, { username: u.username, isPro: u.proSubscriber ?? false });
  }
  return map;
}

/**
 * Build the leaderboard for a time window, ranked by cash won (then wins, then
 * win rate). Only settled entries count; refunds are excluded from winnings.
 */
export async function fetchLeaderboard(
  db: Firestore,
  window: LeaderboardWindow,
  currentUid: string,
): Promise<LeaderboardData> {
  const start = windowStartMs(window);
  const base = db.collectionGroup(COLLECTIONS.entries);
  const snap =
    window === "all"
      ? await base.limit(SCAN_LIMIT).get()
      : await base
          .where("submittedAt", ">=", Timestamp.fromMillis(start))
          .limit(SCAN_LIMIT)
          .get();

  const byUser = new Map<string, Agg>();
  for (const doc of snap.docs) {
    const e = doc.data() as EntryDoc;
    if (e.score === null || e.score === undefined) continue; // settled only

    const won = !e.refunded ? (e.payoutCents ?? 0) : 0;
    const win = won > 0 || (e.payoutCoins ?? 0) > 0;

    let a = byUser.get(e.userId);
    if (!a) {
      a = { userId: e.userId, plays: 0, wins: 0, totalWonCents: 0, timeline: [] };
      byUser.set(e.userId, a);
    }
    a.plays += 1;
    if (win) a.wins += 1;
    a.totalWonCents += won;
    a.timeline.push({ ms: e.submittedAt?.toMillis?.() ?? 0, win });
  }

  const ranked = [...byUser.values()]
    .map((a) => ({
      ...a,
      winRate: a.plays > 0 ? a.wins / a.plays : 0,
      streak: computeStreak(a.timeline),
    }))
    .sort(
      (x, y) =>
        y.totalWonCents - x.totalWonCents ||
        y.wins - x.wins ||
        y.winRate - x.winRate ||
        (x.userId < y.userId ? -1 : 1),
    );

  const top = ranked.slice(0, TOP);
  const currentIndex = ranked.findIndex((a) => a.userId === currentUid);

  const need = new Set(top.map((a) => a.userId));
  if (currentIndex >= 0) need.add(currentUid);
  const userInfo = await fetchUserInfo(db, [...need]);

  const toRow = (a: (typeof ranked)[number], index: number): LeaderRow => {
    const info = userInfo.get(a.userId);
    return {
      rank: index + 1,
      userId: a.userId,
      username: info?.username ?? "player",
      totalWonCents: a.totalWonCents,
      wins: a.wins,
      plays: a.plays,
      winRate: Math.round(a.winRate * 100),
      streak: a.streak,
      isCurrentUser: a.userId === currentUid,
      isPro: info?.isPro ?? false,
    };
  };

  const rows = top.map((a, i) => toRow(a, i));
  const currentUserRow =
    currentIndex >= TOP ? toRow(ranked[currentIndex]!, currentIndex) : null;

  return { window, rows, currentUserRow };
}
