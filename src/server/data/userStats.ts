import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type CategoryStatDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import type { CategoryStat, ChatContext } from "@/lib/ai/chat";

/**
 * Load a player's profile + settled-contest stats for the chat assistant.
 *
 * Both the overall record and the per-category breakdown come from the persisted
 * `users/{uid}/categoryStats` subcollection (written at settlement): overall is
 * the sum across categories, so a single small read replaces the old entries
 * scan. Pass `{ includeCategoryStats: true }` (the Pro advisor / profile) to also
 * return the per-category array; the chat assistant only needs the totals.
 */
export async function fetchUserChatContext(
  db: Firestore,
  uid: string,
  opts?: { includeCategoryStats?: boolean },
): Promise<ChatContext> {
  const [userSnap, categoryStats] = await Promise.all([
    db.collection(COLLECTIONS.users).doc(uid).get(),
    fetchUserCategoryStats(db, uid),
  ]);

  const user = userSnap.data() as UserDoc | undefined;

  let plays = 0;
  let wins = 0;
  let totalWonCents = 0;
  for (const c of categoryStats) {
    plays += c.plays;
    wins += c.wins;
    totalWonCents += c.totalWonCents;
  }

  const ctx: ChatContext = {
    username: user?.username ?? "player",
    coinBalance: user?.coinBalance ?? 0,
    cashBalanceCents: user?.cashBalanceCents ?? 0,
    kycVerified: user?.kycStatus === "verified",
    registeredState: user?.registeredState ?? null,
    plays,
    wins,
    totalWonCents,
    winRatePct: plays > 0 ? Math.round((wins / plays) * 100) : 0,
  };

  if (opts?.includeCategoryStats) {
    ctx.categoryStats = categoryStats;
  }

  return ctx;
}

/**
 * Read a player's persisted per-category aggregates (written incrementally at
 * settlement), shaped as ranked {@link CategoryStat}s with a derived win rate.
 */
export async function fetchUserCategoryStats(
  db: Firestore,
  uid: string,
): Promise<CategoryStat[]> {
  const snap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.categoryStats)
    .get();

  return snap.docs
    .map((d) => {
      const c = d.data() as CategoryStatDoc;
      const plays = c.plays ?? 0;
      const wins = c.wins ?? 0;
      return {
        category: c.category,
        plays,
        wins,
        totalWonCents: c.totalWonCents ?? 0,
        winRatePct: plays > 0 ? Math.round((wins / plays) * 100) : 0,
      };
    })
    .filter((c) => c.plays > 0)
    .sort((a, b) => b.plays - a.plays);
}
