"use server";

import { getStripeServer } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";

export type RedirectResult = { ok: true; url: string } | { ok: false; error: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Ensure the user has a Stripe customer; create + persist one if missing. */
async function ensureCustomer(uid: string): Promise<{ customerId: string } | null> {
  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const snap = await userRef.get();
  const user = snap.data() as UserDoc | undefined;
  if (!user) return null;
  if (user.stripeCustomerId) return { customerId: user.stripeCustomerId };

  const customer = await getStripeServer().customers.create({
    email: user.email,
    metadata: { uid },
  });
  await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
  return { customerId: customer.id };
}

/** Start a Stripe Checkout subscription for the $9.99/mo Pro plan. */
export async function createProCheckout(): Promise<RedirectResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!price) return { ok: false, error: "Pro plan isn't configured yet" };

  const cust = await ensureCustomer(uid);
  if (!cust) return { ok: false, error: "Profile not found" };

  const session = await getStripeServer().checkout.sessions.create({
    mode: "subscription",
    customer: cust.customerId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${APP_URL}/app/pro?status=success`,
    cancel_url: `${APP_URL}/app/pro`,
    subscription_data: { metadata: { uid } },
    metadata: { uid },
  });

  if (!session.url) return { ok: false, error: "Could not start checkout" };
  return { ok: true, url: session.url };
}

/** Open the Stripe Billing Portal to manage/cancel the subscription. */
export async function createBillingPortal(): Promise<RedirectResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user?.stripeCustomerId) {
    return { ok: false, error: "No subscription found" };
  }

  const session = await getStripeServer().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/app/pro`,
  });
  return { ok: true, url: session.url };
}
