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
import { firstBannedLeg } from "@/lib/contest/questionEngine";
import { verifyPrediction } from "@/lib/ai/verification/verifier";
import { fetchEspnGameResult, resolveFeedPrediction, isFeedSlateId, type GameResult } from "@/server/feeds/scores";
import { applySlateToParlays } from "./crossParlay";
import { notifyResultsReady } from "@/lib/notifications/send";
import { HOSTING_FEE_SPLIT } from "@/lib/constants";

export type SettleResult =
  | { ok: true; settled: number; alreadySettled?: boolean; pendingReview?: boolean; notFinal?: boolean }
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

  // Real data-feed slates settle from the FINAL SCORE, not the AI verifier. Fetch the game result once;
  // if the game isn't final yet (games finish hours after lock), revert to `locked` so the next cron
  // run retries — never settle a live game.
  const isFeed = (slate.source === "espn" || slate.source === "oddsapi") && isFeedSlateId(slateId);
  let feedResult: GameResult | null = null;
  if (isFeed) {
    feedResult = await fetchEspnGameResult(slateId);
    if (!feedResult || !feedResult.completed) {
      await slateRef.update({ status: "locked" });
      return { ok: true, settled: 0, notFinal: true };
    }
  }

  // 2. Verify outcomes (multi-source cross-reference) in pick order. Already-
  //    resolved predictions (an admin's manual review) are taken as-is.
  const predsSnap = await slateRef
    .collection(COLLECTIONS.predictions)
    .orderBy("sortOrder", "asc")
    .get();

  // COMPLIANCE — never grade or pay out a slate carrying a banned archetype. Entry is already blocked
  // for these (no legitimate entries to pay), so void it terminally (settled + voided, no cron retry)
  // and stop before any outcome is graded. The display path withholds it regardless of status.
  const bannedLeg = firstBannedLeg(
    predsSnap.docs.map((d) => {
      const p = d.data() as PredictionDoc;
      return { question: p.question, optionA: p.optionA, optionB: p.optionB, type: p.predictionType };
    }),
  );
  if (bannedLeg) {
    console.warn(`[compliance] voiding settlement for ${slateId} — banned leg "${bannedLeg.question}" (${bannedLeg.archetype})`);
    await slateRef.update({ status: "settled", voided: true });
    return { ok: true, settled: 0 };
  }

  const order = predsSnap.docs.map((d) => d.id);
  const results: Record<string, string> = {}; // §2.1 widened; binary still "a"/"b"
  const predBatch = db.batch();
  let needsReview = false;

  const verified = await Promise.all(
    predsSnap.docs.map(async (d) => {
      const pred = d.data() as PredictionDoc;
      // §2.6 — cross-game (archetype) legs never settle on the binary/mock verifier here. Their
      // settlement machinery (proSettle) is separate + gated; on the live path they route to review.
      if (pred.predictionType === "archetype") {
        return { ref: d.ref, id: d.id, resolved: null, verdict: null, feedResolved: false, review: true };
      }
      if (pred.result === "a" || pred.result === "b") {
        return { ref: d.ref, id: d.id, resolved: pred.result, verdict: null, feedResolved: false };
      }
      if (isFeed && feedResult) {
        // Grade from the real final score. A push/tie returns null → routed to manual review below.
        const resolved = resolveFeedPrediction(
          { id: d.id, predictionType: pred.predictionType, optionA: pred.optionA, overUnderLine: pred.overUnderLine },
          feedResult,
        );
        return { ref: d.ref, id: d.id, resolved, verdict: null, feedResolved: resolved != null };
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
      return { ref: d.ref, id: d.id, resolved: null, verdict, feedResolved: false };
    }),
  );

  for (const v of verified) {
    // archetype legs (§2.6) → manual review; never auto-graded on the binary path.
    if ((v as { review?: boolean }).review) { needsReview = true; continue; }
    if (v.resolved) {
      results[v.id] = v.resolved;
      if (v.feedResolved) {
        // Persist the real result + the score as evidence.
        predBatch.set(
          v.ref,
          {
            result: v.resolved,
            verificationSources: [`ESPN final — away ${feedResult!.awayScore}, home ${feedResult!.homeScore}`],
            verificationConfidence: 100,
          },
          { merge: true },
        );
      }
      continue;
    }
    // Feed slate whose market couldn't settle cleanly (push / tie) → manual review, never a guess.
    if (isFeed && !v.verdict) {
      needsReview = true;
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
