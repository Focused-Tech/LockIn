"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getStripeServer } from "@/lib/stripe";
import { depositFeeCents, depositTotalCents } from "@/lib/stripe/fees";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import {
  DEPOSIT_LIMITS,
  DEPOSIT_MAX_CENTS,
  DEPOSIT_MIN_CENTS,
  MIN_WITHDRAWAL_CENTS,
  type PaymentMethodKind,
} from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import {
  fetchDepositUsage,
  isSelfExcluded,
} from "@/server/data/responsiblePlay";
import { isEffectivelyKycVerified } from "@/lib/eligibility";
import { evaluateWithdrawal } from "@/lib/tax/withdrawal";
import { TAX_THRESHOLDS } from "@/lib/tax/config";

export type DepositResult =
  | {
      ok: true;
      clientSecret: string;
      depositId: string;
      netCents: number;
      feeCents: number;
      totalCents: number;
    }
  | { ok: false; error: string };

/**
 * Create a Stripe PaymentIntent for a deposit + a pending deposit record.
 * The customer is charged net + fee (fee = $0 for ACH). The balance is credited
 * by the webhook on payment_intent.succeeded, never optimistically here.
 */
export async function createDepositIntent(input: {
  amountCents: number;
  method: PaymentMethodKind;
}): Promise<DepositResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const netCents = Math.round(input.amountCents);
  if (netCents < DEPOSIT_MIN_CENTS || netCents > DEPOSIT_MAX_CENTS) {
    return {
      ok: false,
      error: `Enter between ${formatCents(DEPOSIT_MIN_CENTS)} and ${formatCents(DEPOSIT_MAX_CENTS)}`,
    };
  }

  const feeCents = depositFeeCents(netCents, input.method);
  const totalCents = depositTotalCents(netCents, input.method);

  const stripe = getStripeServer();
  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.data() as UserDoc | undefined;
  if (!user) return { ok: false, error: "Profile not found" };

  // Responsible play: block while self-excluded, enforce deposit limits.
  if (isSelfExcluded(user)) {
    return { ok: false, error: "Your account is self-excluded. Deposits are paused." };
  }
  const usage = await fetchDepositUsage(db, uid);
  const dailyLimit = user.depositLimitDailyCents ?? DEPOSIT_LIMITS.dailyCents;
  const weeklyLimit = user.depositLimitWeeklyCents ?? DEPOSIT_LIMITS.weeklyCents;
  const monthlyLimit =
    user.depositLimitMonthlyCents ?? DEPOSIT_LIMITS.monthlyCents;
  if (usage.dailyCents + netCents > dailyLimit) {
    return { ok: false, error: `Daily deposit limit reached (${formatCents(dailyLimit)})` };
  }
  if (usage.weeklyCents + netCents > weeklyLimit) {
    return { ok: false, error: `Weekly deposit limit reached (${formatCents(weeklyLimit)})` };
  }
  if (usage.monthlyCents + netCents > monthlyLimit) {
    return { ok: false, error: `Monthly deposit limit reached (${formatCents(monthlyLimit)})` };
  }

  // Ensure a Stripe customer exists for this user.
  let customerId = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { uid },
    });
    customerId = customer.id;
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  const depositRef = db.collection(COLLECTIONS.deposits).doc();
  const intent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    customer: customerId,
    payment_method_types:
      input.method === "ach" ? ["us_bank_account"] : ["card"],
    metadata: {
      uid,
      depositId: depositRef.id,
      netCents: String(netCents),
      feeCents: String(feeCents),
      method: input.method,
    },
  });

  await depositRef.set({
    userId: uid,
    amountCents: netCents,
    feeCents,
    paymentMethod: input.method,
    stripePaymentIntentId: intent.id,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  if (!intent.client_secret) {
    return { ok: false, error: "Could not start payment" };
  }
  return {
    ok: true,
    clientSecret: intent.client_secret,
    depositId: depositRef.id,
    netCents,
    feeCents,
    totalCents,
  };
}

export type WithdrawResult =
  | { ok: true; withdrawalId: string }
  | { ok: false; error: string; code?: "w9_required" };

/**
 * Request a withdrawal: verifies KYC, holds the funds (decrements the cash
 * balance) and creates the record atomically, then initiates the ACH payout.
 *
 * NOTE: paying an end user is a Stripe Connect transfer+payout to their
 * connected account in production; the `payouts.create` call here stands in for
 * that disbursement primitive. payout.paid/failed webhooks finalize the record
 * (and re-credit on failure). If creation fails, the hold is rolled back.
 */
export async function requestWithdrawal(input: {
  amountCents: number;
}): Promise<WithdrawResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const amountCents = Math.round(input.amountCents);
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    return {
      ok: false,
      error: `Minimum withdrawal is ${formatCents(MIN_WITHDRAWAL_CENTS)}`,
    };
  }

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const withdrawalRef = db.collection(COLLECTIONS.withdrawals).doc();

  // Tax/AML context (W-9 on file + this year's reporting flag). Read up front;
  // both change rarely and don't need transactional consistency.
  const taxYear = new Date().getUTCFullYear();
  const [w9Snap, yearSnap] = await Promise.all([
    db.collection(COLLECTIONS.w9Forms).doc(uid).get(),
    userRef.collection(COLLECTIONS.taxYears).doc(String(taxYear)).get(),
  ]);
  const w9OnFile =
    (w9Snap.data() as { onFile?: boolean } | undefined)?.onFile === true;
  const taxReportingRequired =
    (yearSnap.data() as { taxReportingRequired?: boolean } | undefined)
      ?.taxReportingRequired === true;

  // Captured out of the tx for post-commit AML logging (boolean — no narrowing
  // hazard). The withdrawal always pays the authenticated user's OWN account
  // (uid in the payout metadata) — no third-party payouts are possible here.
  let amlReview = false;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const user = snap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");
      // Identity: architect/admin bypass; grandfathered creators count verified.
      if (!isEffectivelyKycVerified(user)) throw new Error("NOT_VERIFIED");
      if (user.cashBalanceCents < amountCents) throw new Error("INSUFFICIENT");

      // Tax/AML gate: W-9 required above threshold (architect/admin exempt);
      // large withdrawals flagged for manual review (never auto-blocked).
      const decision = evaluateWithdrawal(
        { user, amountCents, w9OnFile, taxReportingRequired },
        TAX_THRESHOLDS,
      );
      if (!decision.allowed) throw new Error("W9_REQUIRED");
      amlReview = decision.amlReview;

      tx.update(userRef, {
        cashBalanceCents: user.cashBalanceCents - amountCents,
      });
      tx.set(withdrawalRef, {
        userId: uid,
        amountCents,
        stripePayoutId: null,
        status: "pending",
        amlReview: decision.amlReview,
        requestedAt: FieldValue.serverTimestamp(),
        completedAt: null,
      });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "NOT_VERIFIED") {
      return { ok: false, error: "Verify your identity to withdraw" };
    }
    if (m === "W9_REQUIRED") {
      return {
        ok: false,
        code: "w9_required",
        error:
          "Add your tax info (W-9) before withdrawing. You can complete it in your wallet settings.",
      };
    }
    if (m === "INSUFFICIENT") return { ok: false, error: "Insufficient balance" };
    console.error("[requestWithdrawal] failed", { uid, amountCents, reason: m || err });
    return { ok: false, error: "Could not request withdrawal" };
  }

  // AML: flag large withdrawals for manual review (server-side log; not blocked).
  if (amlReview) {
    console.error("[requestWithdrawal] AML_REVIEW flagged withdrawal", {
      uid,
      amountCents,
      withdrawalId: withdrawalRef.id,
    });
  }

  // Creators with an onboarded connected account get a real Connect transfer to
  // their account (synchronous); everyone else falls back to the platform payout
  // stand-in finalized by the payout.paid/failed webhooks.
  const payerSnap = await userRef.get();
  const payer = payerSnap.data() as UserDoc | undefined;
  const useConnectTransfer = Boolean(
    payer?.creatorStripeConnectId && payer.creatorPayoutsEnabled,
  );

  try {
    if (useConnectTransfer) {
      const transfer = await getStripeServer().transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: payer!.creatorStripeConnectId!,
        metadata: { uid, withdrawalId: withdrawalRef.id },
      });
      await withdrawalRef.set(
        {
          stripePayoutId: transfer.id,
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } else {
      const payout = await getStripeServer().payouts.create({
        amount: amountCents,
        currency: "usd",
        method: "standard",
        metadata: { uid, withdrawalId: withdrawalRef.id },
      });
      await withdrawalRef.set(
        { stripePayoutId: payout.id, status: "processing" },
        { merge: true },
      );
    }
  } catch (err) {
    // NO silent failure: log, then roll back the hold and mark the record failed.
    console.error("[requestWithdrawal] payout initiation failed — rolling back", {
      uid,
      withdrawalId: withdrawalRef.id,
      err,
    });
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const user = snap.data() as UserDoc | undefined;
      tx.set(withdrawalRef, { status: "failed" }, { merge: true });
      if (user) {
        tx.update(userRef, {
          cashBalanceCents: user.cashBalanceCents + amountCents,
        });
      }
    });
    return {
      ok: false,
      error: "Could not initiate payout. Your balance was not charged.",
    };
  }

  return { ok: true, withdrawalId: withdrawalRef.id };
}
