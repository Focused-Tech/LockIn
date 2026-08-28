import type Stripe from "stripe";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStripeServer } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type DepositDoc,
  type UserDoc,
  type WithdrawalDoc,
} from "@/lib/firebase/types";
import { REFERRAL_PRO_COMMISSION_CENTS } from "@/lib/constants";
import { maybeRewardReferral } from "@/server/referrals";

export const runtime = "nodejs";

/**
 * Stripe webhook. The authoritative place balances change for deposits/payouts —
 * never trust the client. Requires the raw body for signature verification.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return new Response("Missing signature", { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripeServer().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      await creditDeposit(event.data.object as Stripe.PaymentIntent);
      break;
    case "payment_intent.payment_failed":
      await failDeposit(event.data.object as Stripe.PaymentIntent);
      break;
    case "payout.paid":
      await completePayout(event.data.object as Stripe.Payout);
      break;
    case "payout.failed":
      await failPayout(event.data.object as Stripe.Payout);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await updateProFromSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await deactivatePro(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
      await rewardProReferral(event.data.object as Stripe.Invoice);
      break;
    case "account.updated":
      await syncConnectAccount(event.data.object as Stripe.Account);
      break;
    case "identity.verification_session.verified":
      await completeIdentityVerification(event.data.object as Stripe.Identity.VerificationSession);
      break;
    case "identity.verification_session.requires_input":
    case "identity.verification_session.canceled":
      await failIdentityVerification(event.data.object as Stripe.Identity.VerificationSession);
      break;
    default:
      break;
  }

  return Response.json({ received: true });
}

/** Keep a creator's payout-eligibility flag in sync with their Connect account. */
async function syncConnectAccount(account: Stripe.Account) {
  const uid = account.metadata?.uid;
  if (!uid) return;
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        creatorStripeConnectId: account.id,
        creatorPayoutsEnabled: Boolean(account.payouts_enabled),
      },
      { merge: true },
    );
}

/** Credit the user's cash balance once, idempotently. */
async function creditDeposit(pi: Stripe.PaymentIntent) {
  const uid = pi.metadata.uid;
  const depositId = pi.metadata.depositId;
  const credit = Number(pi.metadata.netCents) || 0;
  if (!uid || !depositId) return;

  const db = adminDb();
  const depRef = db.collection(COLLECTIONS.deposits).doc(depositId);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);

  await db.runTransaction(async (tx) => {
    const [depSnap, userSnap] = await Promise.all([
      tx.get(depRef),
      tx.get(userRef),
    ]);
    const dep = depSnap.data() as DepositDoc | undefined;
    if (!dep || dep.status === "succeeded") return; // already credited
    const user = userSnap.data() as UserDoc | undefined;

    tx.set(depRef, { status: "succeeded" }, { merge: true });
    if (user) {
      tx.update(userRef, {
        cashBalanceCents: user.cashBalanceCents + credit,
      });
    }
  });

  // First real money in → pay the referrer's cash bonus (idempotent).
  await maybeRewardReferral(db, uid);
}

async function failDeposit(pi: Stripe.PaymentIntent) {
  const depositId = pi.metadata.depositId;
  if (!depositId) return;
  await adminDb()
    .collection(COLLECTIONS.deposits)
    .doc(depositId)
    .set({ status: "failed" }, { merge: true });
}

async function completePayout(payout: Stripe.Payout) {
  const withdrawalId = payout.metadata?.withdrawalId;
  if (!withdrawalId) return;
  await adminDb()
    .collection(COLLECTIONS.withdrawals)
    .doc(withdrawalId)
    .set(
      { status: "completed", completedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
}

/** Mark the withdrawal failed and re-credit the held funds. */
async function failPayout(payout: Stripe.Payout) {
  const withdrawalId = payout.metadata?.withdrawalId;
  const uid = payout.metadata?.uid;
  if (!withdrawalId) return;

  const db = adminDb();
  const wRef = db.collection(COLLECTIONS.withdrawals).doc(withdrawalId);

  await db.runTransaction(async (tx) => {
    const wSnap = await tx.get(wRef);
    const w = wSnap.data() as WithdrawalDoc | undefined;
    if (!w || w.status === "failed" || w.status === "completed") return;

    const userRef = uid ? db.collection(COLLECTIONS.users).doc(uid) : null;
    const userSnap = userRef ? await tx.get(userRef) : null;

    tx.set(wRef, { status: "failed" }, { merge: true });
    if (userRef && userSnap) {
      const user = userSnap.data() as UserDoc | undefined;
      if (user) {
        tx.update(userRef, {
          cashBalanceCents: user.cashBalanceCents + w.amountCents,
        });
      }
    }
  });
}

/** Activate/renew Pro from a subscription create/update (status + period end). */
async function updateProFromSubscription(sub: Stripe.Subscription) {
  const uid = sub.metadata?.uid;
  if (!uid) return;
  const active = sub.status === "active" || sub.status === "trialing";
  const endSec = sub.current_period_end;

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        proSubscriber: active,
        stripeSubscriptionId: sub.id,
        proExpiresAt: endSec ? Timestamp.fromMillis(endSec * 1000) : null,
      },
      { merge: true },
    );
}

async function deactivatePro(sub: Stripe.Subscription) {
  const uid = sub.metadata?.uid;
  if (!uid) return;
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ proSubscriber: false }, { merge: true });
}

/**
 * On each paid Pro invoice, pay the subscriber's referrer the recurring 20%
 * commission. Idempotent per invoice via a deterministic ledger doc id.
 */
async function rewardProReferral(invoice: Stripe.Invoice) {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subId) return; // not a subscription invoice

  const sub = await getStripeServer().subscriptions.retrieve(subId);
  const uid = sub.metadata?.uid;
  if (!uid) return;

  const db = adminDb();
  const earningRef = db
    .collection(COLLECTIONS.creatorEarnings)
    .doc(`pro_${invoice.id}`);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);

  await db.runTransaction(async (tx) => {
    const [earningSnap, userSnap] = await Promise.all([
      tx.get(earningRef),
      tx.get(userRef),
    ]);
    if (earningSnap.exists) return; // already credited this invoice
    const user = userSnap.data() as UserDoc | undefined;
    const referrerUid = user?.referredBy;
    if (!referrerUid) return;

    const bonus = REFERRAL_PRO_COMMISSION_CENTS;
    tx.set(earningRef, {
      creatorId: referrerUid,
      slateId: null,
      earningType: "pro_commission",
      grossCents: bonus,
      platformCutCents: 0,
      creatorNetCents: bonus,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      db.collection(COLLECTIONS.users).doc(referrerUid),
      {
        cashBalanceCents: FieldValue.increment(bonus),
        referralEarningsCents: FieldValue.increment(bonus),
      },
      { merge: true },
    );
  });
}

/**
 * IDENTITY VERIFICATION (Henry handoff assignment 3) — the async second half of
 * src/app/onboarding/actions.ts:verifyIdentity, which only opens the session and sets "pending".
 * Stripe reviews the submitted document + selfie off-request; these two events are how "pending"
 * ever resolves. Guarded by kycStatus === "pending" so a stale/duplicate event can't flip an account
 * that has since been re-verified or was never in this flow.
 */
async function completeIdentityVerification(session: Stripe.Identity.VerificationSession) {
  const uid = session.metadata?.uid;
  if (!uid) return;
  const ref = adminDb().collection(COLLECTIONS.users).doc(uid);
  const snap = await ref.get();
  const user = snap.data() as UserDoc | undefined;
  if (!user || user.kycStatus !== "pending" || user.kycProviderId !== session.id) return;
  await ref.set(
    { kycStatus: "verified", kycVerifiedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

/** A verification that failed or was abandoned — blocks payout exactly like "none" did before this. */
async function failIdentityVerification(session: Stripe.Identity.VerificationSession) {
  const uid = session.metadata?.uid;
  if (!uid) return;
  const ref = adminDb().collection(COLLECTIONS.users).doc(uid);
  const snap = await ref.get();
  const user = snap.data() as UserDoc | undefined;
  if (!user || user.kycStatus !== "pending" || user.kycProviderId !== session.id) return;
  await ref.set({ kycStatus: "failed" }, { merge: true });
}
