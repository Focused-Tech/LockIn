import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type SlateDoc } from "@/lib/firebase/types";
import { settleSlate } from "./settle";

/** Max slates handled per state-transition, per run (keeps the request bounded). */
const PER_RUN_LIMIT = 100;

export interface AutoSettlementReport {
  publishedDrafts: number;
  lockedSlates: number;
  settledSlates: string[];
  /** Slates routed to manual review (outcomes not confidently verified). */
  reviewSlates: string[];
  errors: { slateId: string; error: string }[];
}

/**
 * Time-based slate lifecycle, run on a schedule:
 *   1. Settle slates already 'locked' and past lock time (locked on a prior run,
 *      giving a brief "results pending" window).
 *   2. Lock 'live' slates whose lock time has passed (entries close).
 *   3. Publish 'draft' slates whose promotion window has opened.
 *
 * Settlement is idempotent (status-guarded), so overlapping runs are safe.
 */
export async function runAutoSettlement(): Promise<AutoSettlementReport> {
  const db = adminDb();
  const now = Timestamp.now();
  const report: AutoSettlementReport = {
    publishedDrafts: 0,
    lockedSlates: 0,
    settledSlates: [],
    reviewSlates: [],
    errors: [],
  };

  // 1. Settle locked + expired slates (uses the slates (status, lockTime) index).
  const lockedSnap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "==", "locked")
    .where("lockTime", "<=", now)
    .limit(PER_RUN_LIMIT)
    .get();
  for (const doc of lockedSnap.docs) {
    const result = await settleSlate(doc.id);
    if (result.ok) {
      if (result.pendingReview) report.reviewSlates.push(doc.id);
      else if (!result.alreadySettled) report.settledSlates.push(doc.id);
    } else {
      report.errors.push({ slateId: doc.id, error: result.error });
    }
  }

  // 2. Lock live slates past their lock time.
  const liveSnap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "==", "live")
    .where("lockTime", "<=", now)
    .limit(PER_RUN_LIMIT)
    .get();
  if (!liveSnap.empty) {
    const batch = db.batch();
    liveSnap.docs.forEach((d) => batch.update(d.ref, { status: "locked" }));
    await batch.commit();
    report.lockedSlates = liveSnap.size;
  }

  // 3. Publish scheduled drafts whose promotion window has opened.
  const draftSnap = await db
    .collection(COLLECTIONS.slates)
    .where("status", "==", "draft")
    .limit(PER_RUN_LIMIT)
    .get();
  const toPublish = draftSnap.docs.filter((d) => {
    const s = d.data() as SlateDoc;
    const opensMs = s.promotionOpensAt?.toMillis?.() ?? Infinity;
    return opensMs <= now.toMillis();
  });
  if (toPublish.length > 0) {
    const batch = db.batch();
    toPublish.forEach((d) => batch.update(d.ref, { status: "live" }));
    await batch.commit();
    report.publishedDrafts = toPublish.length;
  }

  return report;
}
