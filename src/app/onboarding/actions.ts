"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { getKycProvider } from "@/lib/kyc";

/** Persist selected interest categories onto the user's Firestore profile. */
export async function saveCategories(categoryNames: string[]): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ categories: categoryNames }, { merge: true });
}

export interface KycInput {
  fullName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ssnLast4: string;
  phone: string;
  /** §2 — the residence perjury attestation, accepted here at signup (moved off the per-contest slate). */
  affirmResidence: boolean;
}

export type KycResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

/**
 * REAL identity verification (Henry handoff assignment 3), via the provider-agnostic KYC adapter
 * (src/lib/kyc — swap-point pattern, `getKycProvider()`). Opens a verification session and records
 * the registered state; `kycStatus` moves to "pending" here, NOT "verified" — the concrete provider
 * (Stripe Identity by default; `KYC_PROVIDER=mock` for local dev) inspects the actual ID + a selfie
 * asynchronously, and the ONE authoritative webhook (`/api/webhooks/kyc`, `processKycWebhook` in
 * src/lib/kyc/webhook.ts) is what flips it to "verified" (with the provider-VERIFIED DOB the new
 * eligibility gate requires) or "rejected" once that finishes. This file never marks a user verified
 * itself — only the signed webhook may do that.
 *
 * The client uses the returned `clientSecretOrUrl` to launch the provider's own hosted flow
 * (Stripe Identity: `stripe.verifyIdentity(clientSecret)` via @stripe/stripe-js) — this file never
 * touches the ID photo, so it needs no Firebase Storage bucket for it.
 *
 * SSN (still collected for identity-adjacent record-keeping some jurisdictions ask for) is
 * intentionally NOT persisted, same as before.
 */
export async function verifyIdentity(input: KycInput): Promise<KycResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  if (input.ssnLast4.replace(/\D/g, "").length !== 4) {
    return { ok: false, error: "Enter the last 4 digits of your SSN" };
  }
  if (!input.affirmResidence) {
    return { ok: false, error: "Accept the residence attestation to verify for cash play." };
  }

  const state = input.state.toUpperCase();
  const session = await getKycProvider().createSession(uid);

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        kycStatus: "pending",
        kycReferenceId: session.sessionId,
        registeredState: state,
        geoState: state,
      },
      { merge: true },
    );

  return { ok: true, clientSecret: session.clientSecretOrUrl };
}

/** Skip KYC — kycStatus stays 'none'; paid contests remain locked. */
export async function skipKyc(): Promise<void> {
  // Nothing to write. Kept explicit for the onboarding flow.
}
