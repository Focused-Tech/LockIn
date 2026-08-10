import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { adminMessaging } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type CrossParlayDoc,
  type EntryDoc,
  type UserDoc,
} from "@/lib/firebase/types";

interface PushPayload {
  title: string;
  body: string;
  /** Deep-link path opened on tap (e.g. /s/<slateId>). */
  link?: string;
}

const MULTICAST_CHUNK = 500; // FCM limit per multicast.

/** Collect device tokens for a set of uids. */
async function tokensForUsers(
  db: Firestore,
  uids: string[],
): Promise<string[]> {
  const unique = [...new Set(uids)];
  if (unique.length === 0) return [];
  const tokens: string[] = [];
  // getAll in chunks (Firestore getAll has no hard cap but keep requests sane).
  for (let i = 0; i < unique.length; i += 300) {
    const refs = unique
      .slice(i, i + 300)
      .map((id) => db.collection(COLLECTIONS.users).doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      const u = s.data() as UserDoc | undefined;
      if (u?.deviceTokens?.length) tokens.push(...u.deviceTokens);
    }
  }
  return [...new Set(tokens)];
}

/** Low-level: send a payload to specific device tokens (chunked multicast). */
export async function sendToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  if (tokens.length === 0) return;
  const messaging = adminMessaging();
  for (let i = 0; i < tokens.length; i += MULTICAST_CHUNK) {
    await messaging
      .sendEachForMulticast({
        tokens: tokens.slice(i, i + MULTICAST_CHUNK),
        notification: { title: payload.title, body: payload.body },
        data: payload.link ? { link: payload.link } : {},
      })
      .catch(() => {}); // never let a push failure break the calling flow
  }
}

/** Send to a set of users by uid. */
export async function sendToUsers(
  db: Firestore,
  uids: string[],
  payload: PushPayload,
): Promise<void> {
  await sendToTokens(await tokensForUsers(db, uids), payload);
}

// ── Triggers ───────────────────────────────────────────────────────────────

/** New slate from a creator → notify their followers. */
export async function notifyFollowersNewSlate(
  db: Firestore,
  creatorId: string,
  slateId: string,
  slateTitle: string,
  isCardRush: boolean,
): Promise<void> {
  const snap = await db
    .collection(COLLECTIONS.users)
    .where("followedCreators", "array-contains", creatorId)
    .limit(2000)
    .get();
  const uids = snap.docs.map((d) => d.id);
  await sendToUsers(db, uids, {
    title: isCardRush ? "⚡ Card Rush is live" : "New contest from a creator you follow",
    body: slateTitle,
    link: `/s/${slateId}`,
  });
}

/** Slate settled → notify everyone who entered that results are ready. */
export async function notifyResultsReady(
  db: Firestore,
  slateId: string,
  slateTitle: string,
): Promise<void> {
  const snap = await db
    .collection(COLLECTIONS.slates)
    .doc(slateId)
    .collection(COLLECTIONS.entries)
    .get();
  const uids = snap.docs.map((d) => (d.data() as EntryDoc).userId);
  await sendToUsers(db, uids, {
    title: "Results are in",
    body: `See how you did in ${slateTitle}.`,
    link: `/s/${slateId}`,
  });
}

/** Shadow-earnings nudge for a free entrant who would have won cash. */
export async function notifyShadowEarnings(
  db: Firestore,
  uid: string,
  tier: number,
  wouldHaveWonCents: number,
): Promise<void> {
  await sendToUsers(db, [uid], {
    title: "You left cash on the table",
    body: `In the $${tier} contest you'd have won $${(wouldHaveWonCents / 100).toFixed(2)}. Add funds to play for real.`,
    link: `/app/wallet`,
  });
}

/** A parlay's contests are all final → tell the owner it settled. */
export async function notifyParlaySettled(
  db: Firestore,
  parlay: CrossParlayDoc,
): Promise<void> {
  await sendToUsers(db, [parlay.userId], {
    title: parlay.refunded ? "Parlay refunded" : "Parlay settled",
    body: parlay.refunded
      ? "A contest was cancelled — your parlay entry was refunded."
      : "Your cross-slate parlay has been graded.",
    link: `/app/parlays`,
  });
}
