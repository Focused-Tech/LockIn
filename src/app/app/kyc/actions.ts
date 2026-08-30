"use server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";
import { getKycProvider } from "@/lib/kyc";

export type StartKycResult =
  | { ok: true; provider: string; clientSecret: string }
  | { ok: false; error: string };

// Best-effort per-instance throttle so a user can't spam provider sessions.
const lastStart = new Map<string, number>();
const THROTTLE_MS = 30_000;

/**
 * Begin identity verification: creates a provider session and marks the user
 * kycStatus="pending". Does NOT grant verification — only the signed webhook can
 * (fail closed). Returns the client secret/URL for the client to launch the flow.
 */
export async function startKycSession(): Promise<StartKycResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (profile.kycStatus === "verified") {
    return { ok: false, error: "Your identity is already verified." };
  }

  const now = Date.now();
  if (now - (lastStart.get(profile.id) ?? 0) < THROTTLE_MS) {
    return {
      ok: false,
      error: "You just started verification — please wait a moment.",
    };
  }
  lastStart.set(profile.id, now);

  try {
    const provider = getKycProvider();
    const session = await provider.createSession(profile.id);
    // Mark pending (never verified here). Reference is written by the webhook.
    await adminDb()
      .collection(COLLECTIONS.users)
      .doc(profile.id)
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
    // NO silent failure. Never leave the user able to think they're verified.
    console.error("[startKycSession] provider createSession failed", err);
    return {
      ok: false,
      error: "Couldn't start verification right now. Please try again.",
    };
  }
}
