import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { fetchFeedSlates } from "@/server/data/slates";
import {
  initialsFor,
  type BeginnerCard,
  type BeginnerFeed,
  type BeginnerPick,
} from "@/lib/beginner/types";

/** Max combo-pool picks surfaced per creator card (keeps the payload lean). */
const MAX_MORE_PICKS = 8;

/**
 * Build the beginner Explore feed from REAL slate data: live slates grouped by
 * creator, each card anchored to the creator (name + hit-rate) with their open
 * picks. Followed creators sort to the top.
 *
 * Honesty rules (no silent fake data):
 *  - hit-rate comes from the creator's `creatorHitRate` field; when absent it is
 *    null and the UI shows "no track record yet" (never a made-up number).
 *  - "% agree" is the AI probability reframed (no community-vote data exists);
 *    see {@link BeginnerPick.agreeA}.
 *  - platform-curated slates (creatorId null) anchor to a "LockIn" house card
 *    with a null hit-rate, rather than being attributed to a fake creator.
 */
export async function fetchBeginnerFeed(
  db: Firestore,
  followedCreators: string[],
): Promise<BeginnerFeed> {
  // Reuse the canonical feed source, then keep only slates that are actually STAKEABLE right now —
  // live AND not past their lock time. (Filtering on status alone leaked expired slates into the
  // feed that the lock action then rejected with "this contest has closed" — a dead-looking button.)
  const now = Date.now();
  const slates = (await fetchFeedSlates(db)).filter((s) => s.status === "live" && s.lockTimeMs > now);

  // Group live slates by creator (null = house). Preserve soonest-first order.
  const byCreator = new Map<string, typeof slates>();
  for (const slate of slates) {
    const key = slate.creatorId ?? "__house__";
    const arr = byCreator.get(key) ?? [];
    arr.push(slate);
    byCreator.set(key, arr);
  }

  // Resolve creator profiles (name + hit-rate) for the real creator ids.
  const creatorIds = [...byCreator.keys()].filter((k) => k !== "__house__");
  const profiles = new Map<string, UserDoc>();
  if (creatorIds.length) {
    const refs = creatorIds.map((id) =>
      db.collection(COLLECTIONS.users).doc(id),
    );
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) profiles.set(snap.id, snap.data() as UserDoc);
    }
  }

  const followed = new Set(followedCreators);

  const toPick = (
    slateId: string,
    lockTimeMs: number,
    category: string,
    p: { id: string; question: string; optionA: string; optionB: string; probA: number; probB: number },
  ): BeginnerPick => ({
    slateId,
    predictionId: p.id,
    category,
    question: p.question,
    optionA: p.optionA,
    optionB: p.optionB,
    agreeA: p.probA,
    agreeB: p.probB,
    lockTimeMs,
  });

  const cards: BeginnerCard[] = [];
  for (const [key, group] of byCreator) {
    const isHouse = key === "__house__";
    const profile = isHouse ? undefined : profiles.get(key);
    // Flatten this creator's open picks across their live slates.
    const allPicks: BeginnerPick[] = group.flatMap((s) =>
      s.predictions.map((p) => toPick(s.id, s.lockTimeMs, s.category, p)),
    );
    if (allPicks.length === 0) continue;

    const [headline, ...rest] = allPicks;
    const creatorName = isHouse
      ? "LockIn"
      : (profile?.username ?? "Creator");

    cards.push({
      creatorId: isHouse ? null : key,
      creatorName,
      initials: isHouse ? "LK" : initialsFor(creatorName),
      hitRate: isHouse ? null : (profile?.creatorHitRate ?? null),
      isHouse,
      isFollowed: !isHouse && followed.has(key),
      headline: headline!,
      morePicks: rest.slice(0, MAX_MORE_PICKS),
    });
  }

  // Followed creators first, then soonest headline lock time.
  cards.sort((a, b) => {
    if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
    return a.headline.lockTimeMs - b.headline.lockTimeMs;
  });

  return { cards };
}
