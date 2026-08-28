"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { getStripeServer } from "@/lib/stripe";
import { COLLECTIONS } from "@/lib/firebase/types";
import { PERJURY_ATTESTATION_TEXT, PERJURY_ATTESTATION_VERSION } from "@/lib/eligibility";

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
 * REAL identity verification (Henry handoff assignment 3 — Stripe Identity, the ruled provider).
 * Two steps, not one: this records the self-reported fields we still need on our own account (the
 * residence attestation + registered state that `verifyForCash`'s address cross-check reads — those
 * aren't proof of identity, just a signed statement) and opens a Stripe Identity VerificationSession.
 * `kycStatus` moves to "pending" here, NOT "verified" — Stripe inspects the actual ID + a selfie
 * asynchronously; the webhook (`identity.verification_session.verified` /
 * `.requires_input` / `.canceled` in src/app/api/webhooks/stripe/route.ts) is what flips it to
 * "verified" or "failed" once that finishes. A failed verification therefore blocks payout the same
 * way an unverified one always did (submitEntry/verifyForCash never read this file's writes directly).
 *
 * The client calls `stripe.verifyIdentity(clientSecret)` (@stripe/stripe-js) with the value returned
 * here to launch Stripe's own hosted document-capture modal — this file never touches the ID photo,
 * so it needs no Firebase Storage bucket for it (that gap in the original handoff doesn't apply once
 * the document capture is Stripe-hosted, not ours).
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

  const session = await getStripeServer().identity.verificationSessions.create({
    type: "document",
    metadata: { uid },
    options: { document: { require_matching_selfie: true } },
  });
  if (!session.client_secret) return { ok: false, error: "Could not start identity verification" };

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        kycStatus: "pending",
        kycProviderId: session.id,
        registeredState: state,
        geoState: state,
        // §2 — record the penalty-of-perjury residence attestation ONCE, here in the signup flow
        // (the state is known at this step). No longer re-confirmed on every slate.
        cashAttestation: {
          affirmedState: state,
          acceptedAt: FieldValue.serverTimestamp(),
          text: PERJURY_ATTESTATION_TEXT,
          version: PERJURY_ATTESTATION_VERSION,
        },
      },
      { merge: true },
    );

  return { ok: true, clientSecret: session.client_secret };
}

/** Skip KYC — kycStatus stays 'none'; paid contests remain locked. */
export async function skipKyc(): Promise<void> {
  // Nothing to write. Kept explicit for the onboarding flow.
}
