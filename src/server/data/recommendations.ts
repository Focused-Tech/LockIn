import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type EntryDoc } from "@/lib/firebase/types";
import type { RecSignals } from "@/lib/recommendations";
import { fetchUserCategoryStats } from "./userStats";

/**
 * Gather a user's "For you" signals: per-category performance (persisted), tier
 * history (recent entries), and followed creators. Deterministic — no LLM.
 */
export async function fetchRecSignals(
  db: Firestore,
  uid: string,
  followedCreators: string[],
): Promise<RecSignals> {
  const [cats, entriesSnap] = await Promise.all([
    fetchUserCategoryStats(db, uid),
    db
      .collectionGroup(COLLECTIONS.entries)
      .where("userId", "==", uid)
      .limit(100)
      .get(),
  ]);

  const categoryWinRates: Record<string, number> = {};
  const categoryPlays: Record<string, number> = {};
  for (const c of cats) {
    categoryWinRates[c.category] = c.winRatePct;
    categoryPlays[c.category] = c.plays;
  }

  const tierCounts: Record<number, number> = {};
  for (const d of entriesSnap.docs) {
    const e = d.data() as EntryDoc;
    tierCounts[e.entryTier] = (tierCounts[e.entryTier] ?? 0) + 1;
  }

  return { categoryWinRates, categoryPlays, followedCreators, tierCounts };
}
