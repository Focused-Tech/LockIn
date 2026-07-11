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

/** We only collect the residency state (for geo-fencing). Identity documents are
 * captured by the KYC provider directly — we never collect SSN/ID ourselves. */
export interface KycInput {
  state: string;
}

export type KycResult =
  | { ok: true; provider: string; clientSecret: string }
  | { ok: false; error: string };

/**
 * Start a REAL identity-verification session via the configured KycProvider.
 *
 * This does NOT verify anyone — it creates a provider session and marks the user
 * kycStatus="pending". ONLY the signed provider webhook (/api/webhooks/kyc) can
 * set kycStatus="verified". Strangers are never self-marked verified here. The
 * architect/admin/grandfathered override path is separate and never enters KYC.
 */
export async function startIdentityVerification(
  input: KycInput,
): Promise<KycResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const state = input.state.trim().toUpperCase();
  if (state.length !== 2) {
    return { ok: false, error: "Select your state of residence" };
  }

  try {
    // Residency state for geo-fencing (NOT identity verification).
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .set({ registeredState: state, geoState: state }, { merge: true });

    // Launch the provider session and mark pending (never verified).
    const provider = getKycProvider();
    const session = await provider.createSession(uid);
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .set(
        { kycStatus: "pending", kycProvider: provider.name },
        { merge: true },
      );

    return {
      ok: true,
      provider: provider.name,
      clientSecret: session.clientSecretOrUrl,
    };
  } catch (err) {
    // NO silent failure. Never leave a stranger thinking they're verified.
    console.error("[startIdentityVerification] failed to start session", err);
    return {
      ok: false,
      error: "Couldn't start verification right now. Please try again.",
    };
  }
}

/** Skip KYC — kycStatus stays 'unverified'; paid contests remain locked. */
export async function skipKyc(): Promise<void> {
  // Nothing to write. Kept explicit for the onboarding flow.
}
