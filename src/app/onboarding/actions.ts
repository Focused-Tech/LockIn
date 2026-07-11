"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

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

  // Simulate the Persona verification round-trip.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // NOTE: BYPASS — this mock marks the user verified WITHOUT a real provider.
  // The authoritative KYC path is now the provider session + signed webhook
  // (src/lib/kyc, /api/webhooks/kyc). This onboarding step should be converted
  // to launch a provider session rather than instant-verify. Left functional
  // for existing onboarding UX; kycVerifiedDob here is the self-entered DOB as a
  // dev stand-in, NOT a provider-verified value.
  const snap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  const selfDob = (snap.data() as { dateOfBirth?: string } | undefined)
    ?.dateOfBirth;

  await adminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set(
      {
        kycStatus: "verified",
        kycVerifiedAt: FieldValue.serverTimestamp(),
        kycProvider: "mock",
        kycReferenceId: `mock_onboarding_${uid.slice(0, 8)}`,
        kycVerifiedDob: selfDob ?? null,
        registeredState: input.state.toUpperCase(),
        geoState: input.state.toUpperCase(),
      },
      { merge: true },
    );

  return { ok: true };
}

/** Skip KYC — kycStatus stays 'none'; paid contests remain locked. */
export async function skipKyc(): Promise<void> {
  // Nothing to write. Kept explicit for the onboarding flow.
}
