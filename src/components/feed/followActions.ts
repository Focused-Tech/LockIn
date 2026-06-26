"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

/** Follow or unfollow a creator (drives "For you" recommendations). */
export async function toggleFollowCreator(
  creatorId: string,
  follow: boolean,
): Promise<{ ok: boolean }> {
  const uid = await getCurrentUserId();
  if (!uid || uid === creatorId) return { ok: false };

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        followedCreators: follow
          ? FieldValue.arrayUnion(creatorId)
          : FieldValue.arrayRemove(creatorId),
      },
      { merge: true },
    );
  return { ok: true };
}
