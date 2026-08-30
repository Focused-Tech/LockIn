import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS, type KycStatus, type UserDoc } from "@/lib/firebase/types";
import type { KycProvider } from "./types";

/**
 * Minimal Firestore surface the processor needs — satisfied by the Admin SDK's
 * Firestore in production and by a tiny fake in tests, so idempotency + the
 * bad-signature path are unit-testable without a live database.
 */
export interface UserWriteDb {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ exists: boolean; data(): unknown }>;
      set(data: unknown, opts: { merge: boolean }): Promise<unknown>;
    };
  };
}

export interface KycWebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Authoritative KYC status writer. FAIL CLOSED + no silent failure:
 *  - invalid/unsigned webhook → 400, console.error, NOTHING is written.
 *  - unparseable / unknown user → ack (200) to stop retries, but write nothing.
 *  - valid → normalize and update ONLY the allowed KYC fields (no raw PII).
 * Idempotent: the same (status, referenceId) already on the doc is a no-op, so a
 * retried delivery has exactly one effect.
 */
export async function processKycWebhook({
  provider,
  rawBody,
  signature,
  db,
}: {
  provider: KycProvider;
  rawBody: string;
  signature: string | null;
  db: UserWriteDb;
}): Promise<KycWebhookOutcome> {
  const verification = provider.verifyWebhook(rawBody, signature);
  if (!verification.valid) {
    console.error("[kyc webhook] invalid signature — rejected, no changes made");
    return { status: 400, body: { error: "invalid_signature" } };
  }

  let parsed;
  try {
    parsed = await provider.parseResult(verification.event);
  } catch (err) {
    console.error("[kyc webhook] failed to parse a verified event", err);
    return { status: 400, body: { error: "unparseable_event" } };
  }

  if (!parsed.userId) {
    console.error("[kyc webhook] verified event missing userId", {
      eventId: parsed.eventId,
    });
    return { status: 200, body: { ignored: true } }; // ack so it isn't retried
  }

  const userRef = db.collection(COLLECTIONS.users).doc(parsed.userId);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error("[kyc webhook] no user for event", { userId: parsed.userId });
    return { status: 200, body: { ignored: true } };
  }
  const user = snap.data() as UserDoc;
  const newStatus: KycStatus = parsed.status;

  // IDEMPOTENT: identical status + reference already applied → do nothing.
  if (
    user.kycStatus === newStatus &&
    user.kycReferenceId === parsed.referenceId
  ) {
    return { status: 200, body: { applied: false, idempotent: true } };
  }

  const update: Record<string, unknown> = {
    kycStatus: newStatus,
    kycProvider: provider.name,
    kycReferenceId: parsed.referenceId,
  };
  if (newStatus === "verified") {
    update.kycVerifiedAt = FieldValue.serverTimestamp();
    // Store ONLY the provider-verified DOB (the sole PII we persist).
    update.kycVerifiedDob = parsed.verifiedDob ?? null;
    if (!parsed.verifiedDob) {
      console.error(
        "[kyc webhook] verified with no provider DOB — age check will fail closed",
        { userId: parsed.userId },
      );
    }
  }

  await userRef.set(update, { merge: true });
  return { status: 200, body: { applied: true, status: newStatus } };
}
