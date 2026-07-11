import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type EntryDoc,
  type PredictionDoc,
  type SlateDoc,
} from "@/lib/firebase/types";
import { settleEntries, type SettlementEntryInput } from "@/lib/contest";
import { verifyPrediction } from "@/lib/ai/verification/verifier";
import { applySlateToParlays } from "./crossParlay";
import { notifyResultsReady } from "@/lib/notifications/send";
import { recordWinningForTax } from "@/lib/ledger/winnings";
import { HOSTING_FEE_SPLIT } from "@/lib/constants";

export type SettleResult =
  | { ok: true; settled: number; alreadySettled?: boolean; pendingReview?: boolean }
  | { ok: false; error: string };

/** Max writes per Firestore batch (limit is 500; leave headroom). */
const BATCH_LIMIT = 400;

/**
 * Settle a slate end-to-end:
 *  1. Atomically claim it (status → 'settling') so re-runs are no-ops.
 *  2. Resolve any unresolved predictions via the (mock) AI verifier.
 *  3. Score, rank, and compute payouts with the pure settlement engine.
 *  4. Write per-entry results and credit user balances (atomic increments).
 *  5. Mark the slate 'settled'.
 *
 * Idempotent at the slate level via the status guard.
 */
export async function settleSlate(slateId: string): Promise<SettleResult> {
  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc(slateId);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(slateRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const slate = snap.data() as SlateDoc;
      if (slate.status === "settled") throw new Error("ALREADY");
      if (slate.status === "settling") throw new Error("IN_PROGRESS");
      tx.update(slateRef, { status: "settling" });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "ALREADY") return { ok: true, settled: 0, alreadySettled: true };
    if (m === "NOT_FOUND") return { ok: false, error: "Slate not found" };
    if (m === "IN_PROGRESS")
      return { ok: false, error: "Settlement already in progress" };
    return { ok: false, error: "Could not start settlement" };
  }

  const slate = (await slateRef.get()).data() as SlateDoc;

  // 2. Verify outcomes (multi-source cross-reference) in pick order. Already-
  //    resolved predictions (an admin's manual review) are taken as-is.
  const predsSnap = await slateRef
    .collection(COLLECTIONS.predictions)
    .orderBy("sortOrder", "asc")
    .get();

  const order = predsSnap.docs.map((d) => d.id);
  const results: Record<string, "a" | "b"> = {};
  const predBatch = db.batch();
  let needsReview = false;

  const verified = await Promise.all(
    predsSnap.docs.map(async (d) => {
      const pred = d.data() as PredictionDoc;
      if (pred.result === "a" || pred.result === "b") {
        return { ref: d.ref, id: d.id, resolved: pred.result, verdict: null };
      }
      const verdict = await verifyPrediction({
        id: d.id,
        question: pred.question,
        optionA: pred.optionA,
        optionB: pred.optionB,
        category: slate.category,
        predictionType: pred.predictionType,
        overUnderLine: pred.overUnderLine,
        optionAProbability: pred.optionAProbability,
        optionBProbability: pred.optionBProbability,
      });
      return { ref: d.ref, id: d.id, resolved: null, verdict };
    }),
  );

  for (const v of verified) {
    if (v.resolved) {
      results[v.id] = v.resolved;
      continue;
    }
    const verdict = v.verdict!;
    const settleable = verdict.autoSettle && verdict.choice !== null;
    // Always persist the gathered evidence; only stamp `result` when confident.
    predBatch.set(
      v.ref,
      {
        verificationSources: verdict.votes.map(
          (x) => `${x.source}: ${x.detail}`,
        ),
        verificationConfidence: Math.round(verdict.confidence * 100),
        ...(settleable ? { result: verdict.choice } : {}),
      },
      { merge: true },
    );
    if (settleable) results[v.id] = verdict.choice!;
    else needsReview = true;
  }
  await predBatch.commit();

  // Route to manual review when any outcome isn't confidently verified.
  if (needsReview) {
    await slateRef.update({ status: "pending_review" });
    return { ok: true, settled: 0, pendingReview: true };
  }

  // 3. Score + rank + payouts.
  const entriesSnap = await slateRef.collection(COLLECTIONS.entries).get();
  const inputs: SettlementEntryInput[] = entriesSnap.docs.map((d) => {
    const e = d.data() as EntryDoc;
    return {
      id: d.id,
      userId: e.userId,
      entryTier: e.entryTier,
      hostingFeeCents: e.hostingFeeCents,
      isPaid: e.isPaid,
      submittedAtMs: e.submittedAt?.toMillis?.() ?? 0,
      picks: e.picks,
    };
  });
  const summary = settleEntries(inputs, results, order, {
    prizeMultiplier: slate?.rushMultiplier ?? 1,
  });

  // 4. Apply per-entry results + credit balances (chunked batches).
  // Fee lookup for the tax ledger: a winning PAID entry's cost = tier*100 + fee.
  const feeById = new Map(
    inputs.map((e) => [
      e.id,
      { isPaid: e.isPaid, feeCents: e.entryTier * 100 + e.hostingFeeCents },
    ]),
  );
  // Cash winners to record for tax AFTER balances are credited.
  const taxWinners: { uid: string; grossCents: number; entryFeeCents: number }[] =
    [];
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };

  for (const r of summary.entries) {
    batch.set(
      slateRef.collection(COLLECTIONS.entries).doc(r.id),
      {
        score: r.score,
        rank: r.rank,
        payoutCents: r.payoutCents,
        payoutCoins: r.payoutCoins,
        refunded: r.refunded,
      },
      { merge: true },
    );
    ops += 1;

    if (r.payoutCents > 0 || r.payoutCoins > 0) {
      const inc: Record<string, FieldValue> = {};
      if (r.payoutCents > 0)
        inc.cashBalanceCents = FieldValue.increment(r.payoutCents);
      if (r.payoutCoins > 0)
        inc.coinBalance = FieldValue.increment(r.payoutCoins);
      batch.set(db.collection(COLLECTIONS.users).doc(r.userId), inc, {
        merge: true,
      });
      ops += 1;

      // Track CASH winnings (non-refunded) for the immutable tax ledger. Free
      // (coin) prizes are not reportable cash winnings and are skipped.
      if (!r.refunded && r.payoutCents > 0) {
        const fee = feeById.get(r.id);
        taxWinners.push({
          uid: r.userId,
          grossCents: r.payoutCents,
          entryFeeCents: fee?.isPaid ? fee.feeCents : 0,
        });
      }
    }

    // Persisted per-category aggregate (one entry per user per slate, so each
    // user's category doc is written at most once here). Matches the read-time
    // definition: every settled entry is a play; a win has a non-refunded cash
    // or coin payout. Increments are idempotent via the slate status guard.
    const wonCents = r.refunded ? 0 : r.payoutCents;
    const isWin = wonCents > 0 || r.payoutCoins > 0;
    batch.set(
      db
        .collection(COLLECTIONS.users)
        .doc(r.userId)
        .collection(COLLECTIONS.categoryStats)
        .doc(slate.category),
      {
        category: slate.category,
        plays: FieldValue.increment(1),
        wins: FieldValue.increment(isWin ? 1 : 0),
        totalWonCents: FieldValue.increment(wonCents),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;

    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  // 4a. Tax seam: immutable winnings ledger + rolling annual totals + 1099 flag.
  // Idempotent per (slate,user); safe to re-run. Never blocks settlement — a
  // failure here is logged and surfaced, not swallowed, but balances are already
  // credited above.
  for (const w of taxWinners) {
    try {
      await recordWinningForTax(db, {
        uid: w.uid,
        slateId,
        grossCents: w.grossCents,
        entryFeeCents: w.entryFeeCents,
      });
    } catch (err) {
      console.error("[settleSlate] tax ledger write failed", {
        slateId,
        uid: w.uid,
        err,
      });
    }
  }

  // 4b. Creator hosting earnings: 40% of hosting fees on non-refunded paid
  // entries → creatorEarnings ledger + credit the creator's balance.
  const refundedKeys = new Set(
    summary.groups.filter((g) => g.refunded).map((g) => g.key),
  );
  let hostingGrossCents = 0;
  for (const e of inputs) {
    if (e.isPaid && !refundedKeys.has(`paid:${e.entryTier}`)) {
      hostingGrossCents += e.hostingFeeCents;
    }
  }
  if (slate?.creatorId && hostingGrossCents > 0) {
    const creatorNetCents = Math.floor(
      hostingGrossCents * HOSTING_FEE_SPLIT.creator,
    );
    const platformCutCents = hostingGrossCents - creatorNetCents;
    const earningsBatch = db.batch();
    earningsBatch.set(
      db.collection(COLLECTIONS.creatorEarnings).doc(`hosting_${slateId}`),
      {
        creatorId: slate.creatorId,
        slateId,
        earningType: "hosting",
        grossCents: hostingGrossCents,
        platformCutCents,
        creatorNetCents,
        createdAt: FieldValue.serverTimestamp(),
      },
    );
    earningsBatch.set(
      db.collection(COLLECTIONS.users).doc(slate.creatorId),
      { cashBalanceCents: FieldValue.increment(creatorNetCents) },
      { merge: true },
    );
    await earningsBatch.commit();
  }

  // 5. Finalize.
  await slateRef.update({
    status: "settled",
    settledAt: FieldValue.serverTimestamp(),
  });

  // 6. Resolve this slate's picks inside any cross-slate parlays.
  await applySlateToParlays(db, slateId, results);

  // 7. Push: tell entrants their results are ready.
  await notifyResultsReady(db, slateId, slate.title).catch(() => {});

  return { ok: true, settled: summary.entries.length };
}
