"use server";

import { getStripeServer } from "@/lib/stripe";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type RedirectResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Begin (or resume) Stripe Connect Express onboarding for an approved creator.
 * Creates the connected account on first call, then returns a hosted onboarding
 * link. Payout capability is confirmed later via `refreshConnectStatus` / the
 * `account.updated` webhook.
 */
export async function startConnectOnboarding(): Promise<RedirectResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!profile.creatorVerified) {
    return { ok: false, error: "Only approved creators can set up payouts" };
  }

  const stripe = getStripeServer();
  const userRef = adminDb().collection(COLLECTIONS.users).doc(profile.id);

  let accountId = profile.creatorStripeConnectId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: profile.email,
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      metadata: { uid: profile.id },
    });
    accountId = account.id;
    await userRef.set({ creatorStripeConnectId: accountId }, { merge: true });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/app/creator?connect=refresh`,
    return_url: `${APP_URL}/app/creator?connect=return`,
    type: "account_onboarding",
  });
  return { ok: true, url: link.url };
}

/** Re-check whether the creator's connected account can receive payouts. */
export async function refreshConnectStatus(): Promise<{ enabled: boolean }> {
  const profile = await getCurrentUserProfile();
  if (!profile?.creatorStripeConnectId) return { enabled: false };

  const account = await getStripeServer().accounts.retrieve(
    profile.creatorStripeConnectId,
  );
  const enabled = Boolean(account.payouts_enabled);

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(profile.id)
    .set({ creatorPayoutsEnabled: enabled }, { merge: true });

  return { enabled };
}
