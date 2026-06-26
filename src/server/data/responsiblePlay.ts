import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type DepositDoc,
  type FsTimestamp,
} from "@/lib/firebase/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the user is currently self-excluded. */
export function isSelfExcluded(user: {
  selfExclusionUntil: FsTimestamp | null;
}): boolean {
  const ms = user.selfExclusionUntil?.toMillis?.() ?? 0;
  return ms > Date.now();
}

export interface DepositUsage {
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}

/**
 * Sum a user's deposits (succeeded + pending — pending counts so limits can't be
 * gamed by rapid retries) across rolling 1/7/30-day windows.
 */
export async function fetchDepositUsage(
  db: Firestore,
  uid: string,
): Promise<DepositUsage> {
  const snap = await db
    .collection(COLLECTIONS.deposits)
    .where("userId", "==", uid)
    .limit(500)
    .get();

  const now = Date.now();
  const usage: DepositUsage = { dailyCents: 0, weeklyCents: 0, monthlyCents: 0 };

  for (const doc of snap.docs) {
    const d = doc.data() as DepositDoc;
    if (d.status !== "succeeded" && d.status !== "pending") continue;
    const ms = d.createdAt?.toMillis?.() ?? 0;
    if (ms >= now - 30 * DAY_MS) usage.monthlyCents += d.amountCents;
    if (ms >= now - 7 * DAY_MS) usage.weeklyCents += d.amountCents;
    if (ms >= now - DAY_MS) usage.dailyCents += d.amountCents;
  }

  return usage;
}
