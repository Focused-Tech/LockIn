"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
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

export type KycResult = { ok: true } | { ok: false; error: string };

/**
 * MOCK Persona identity verification. Simulates the ~3s provider round-trip,
 * then marks the user verified. SSN is intentionally NOT persisted. Real Persona
 * integration replaces the delay + status write here.
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

  // Simulate the Persona verification round-trip.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const state = input.state.toUpperCase();
  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        kycStatus: "verified",
        kycVerifiedAt: FieldValue.serverTimestamp(),
        kycProviderId: `mock_persona_${uid.slice(0, 8)}`,
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

  return { ok: true };
}

/** Skip KYC — kycStatus stays 'none'; paid contests remain locked. */
export async function skipKyc(): Promise<void> {
  // Nothing to write. Kept explicit for the onboarding flow.
}
