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
  | { ok: false; error: string };

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

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const user = snap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");
      if (user.kycStatus !== "verified") throw new Error("NOT_VERIFIED");
      if (user.cashBalanceCents < amountCents) throw new Error("INSUFFICIENT");

      tx.update(userRef, {
        cashBalanceCents: user.cashBalanceCents - amountCents,
      });
      tx.set(withdrawalRef, {
        userId: uid,
        amountCents,
        stripePayoutId: null,
        status: "pending",
        requestedAt: FieldValue.serverTimestamp(),
        completedAt: null,
      });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "NOT_VERIFIED") {
      return { ok: false, error: "Verify your identity to withdraw" };
    }
    if (m === "INSUFFICIENT") return { ok: false, error: "Insufficient balance" };
    return { ok: false, error: "Could not request withdrawal" };
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
  } catch {
    // Roll back the hold and mark the record failed.
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
