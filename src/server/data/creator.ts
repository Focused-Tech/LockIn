import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type CreatorEarningDoc,
  type SlateDoc,
} from "@/lib/firebase/types";

export interface CreatorSlateRow {
  id: string;
  title: string;
  category: string;
  status: string;
  entryCount: number;
  /** Realized creator net earnings tied to this slate (cents). */
  netCents: number;
}

export interface CreatorDashboard {
  totalNetCents: number;
  byType: {
    hosting: number;
    package: number;
    referral: number;
    pro_commission: number;
  };
  slateCount: number;
  totalEntries: number;
  slates: CreatorSlateRow[];
}

/** Aggregate a creator's earnings ledger + hosted slates for the dashboard. */
export async function fetchCreatorDashboard(
  db: Firestore,
  uid: string,
): Promise<CreatorDashboard> {
  const [earningsSnap, slatesSnap] = await Promise.all([
    db.collection(COLLECTIONS.creatorEarnings).where("creatorId", "==", uid).get(),
    db.collection(COLLECTIONS.slates).where("creatorId", "==", uid).get(),
  ]);

  const byType = { hosting: 0, package: 0, referral: 0, pro_commission: 0 };
  const netBySlate = new Map<string, number>();
  let totalNetCents = 0;

  for (const doc of earningsSnap.docs) {
    const e = doc.data() as CreatorEarningDoc;
    totalNetCents += e.creatorNetCents;
    byType[e.earningType] += e.creatorNetCents;
    if (e.slateId) {
      netBySlate.set(e.slateId, (netBySlate.get(e.slateId) ?? 0) + e.creatorNetCents);
    }
  }

  const rows = slatesSnap.docs
    .map((doc) => {
      const s = doc.data() as SlateDoc;
      return {
        id: doc.id,
        title: s.title,
        category: s.category,
        status: s.status,
        entryCount: s.entryCount ?? 0,
        netCents: netBySlate.get(doc.id) ?? 0,
        createdAtMs: s.createdAt?.toMillis?.() ?? 0,
      };
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  const totalEntries = rows.reduce((n, r) => n + r.entryCount, 0);

  return {
    totalNetCents,
    byType,
    slateCount: rows.length,
    totalEntries,
    slates: rows.map(({ createdAtMs: _omit, ...row }) => row),
  };
}
