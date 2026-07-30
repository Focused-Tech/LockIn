import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type CrossParlayDoc,
  type CrossParlayPick,
} from "@/lib/firebase/types";
import { settleParlays, type ParlayInput } from "@/lib/contest/crossParlay";
import type { EntryTier } from "@/lib/constants";

const BATCH_LIMIT = 400;

/**
 * Apply a just-resolved slate to every open parlay that includes it. Marks each
 * of that slate's picks correct/incorrect (or void when the slate is cancelled,
 * results = null), and flips the parlay to `ready` once all its picks resolve.
 */
export async function applySlateToParlays(
  db: Firestore,
  slateId: string,
  results: Record<string, string> | null, // §2.1 widened; cross-parlays are binary feed slates ("a"/"b")
): Promise<void> {
  // array-contains alone (single-field index); status filtered in memory.
  const snap = await db
    .collection(COLLECTIONS.crossParlays)
    .where("slateIds", "array-contains", slateId)
    .get();
  const open = snap.docs.filter(
    (d) => (d.data() as CrossParlayDoc).status === "open",
  );
  if (open.length === 0) return;

  const batch = db.batch();
  for (const doc of open) {
    const parlay = doc.data() as CrossParlayDoc;
    const picks: CrossParlayPick[] = parlay.picks.map((pk) => {
      if (pk.slateId !== slateId || pk.status !== "pending") return pk;
      if (results === null) return { ...pk, status: "void" };
      const res = results[pk.predictionId];
      const status =
        res === undefined ? "void" : pk.pickValue === res ? "correct" : "incorrect";
      return { ...pk, status };
    });
    const allResolved = picks.every((pk) => pk.status !== "pending");
    batch.set(
      doc.ref,
      allResolved ? { picks, status: "ready" } : { picks },
      { merge: true },
    );
  }
  await batch.commit();
}

/**
 * Settle every `ready` parlay into its own per-tier pools (rake / payout curve /
 * 1,000× cap / refunds) and credit balances. Idempotent across runs: settled
 * parlays leave the `ready` set.
 */
export async function settleReadyParlays(
  db: Firestore,
): Promise<{ settled: number }> {
  const snap = await db
    .collection(COLLECTIONS.crossParlays)
    .where("status", "==", "ready")
    .limit(2000)
    .get();
  if (snap.empty) return { settled: 0 };

  const inputs: ParlayInput[] = snap.docs.map((d) => {
    const p = d.data() as CrossParlayDoc;
    return {
      id: d.id,
      userId: p.userId,
      entryTier: p.entryTier as EntryTier,
      isPaid: p.isPaid,
      submittedAtMs: p.submittedAt?.toMillis?.() ?? 0,
      picks: p.picks.map((pk) => ({
        correct:
          pk.status === "correct"
            ? true
            : pk.status === "incorrect"
              ? false
              : null, // void / pending → excluded from scoring
        lockTimeMs: pk.lockTimeMs,
      })),
    };
  });

  const { results } = settleParlays(inputs);
  const refById = new Map(snap.docs.map((d) => [d.id, d.ref]));

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  for (const r of results) {
    const ref = refById.get(r.id);
    if (!ref) continue;
    batch.set(
      ref,
      {
        totalScore: r.score,
        rank: r.rank,
        payoutCents: r.payoutCents,
        payoutCoins: r.payoutCoins,
        refunded: r.refunded,
        status: r.refunded ? "refunded" : "settled",
        settledAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;

    if (r.payoutCents > 0 || r.payoutCoins > 0) {
      const inc: Record<string, FieldValue> = {};
      if (r.payoutCents > 0)
        inc.cashBalanceCents = FieldValue.increment(r.payoutCents);
      if (r.payoutCoins > 0) inc.coinBalance = FieldValue.increment(r.payoutCoins);
      batch.set(db.collection(COLLECTIONS.users).doc(r.userId), inc, {
        merge: true,
      });
      ops += 1;
    }
    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  return { settled: results.length };
}
