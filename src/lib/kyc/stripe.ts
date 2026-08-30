import "server-only";
import type Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe";
import type {
  KycParsedResult,
  KycProvider,
  KycResultStatus,
  KycSession,
  KycWebhookVerification,
} from "./types";

/**
 * StripeIdentityProvider — Stripe Identity (same vendor as payments, least
 * friction). ALL Stripe-specific detail lives here. Secrets are read from
 * server-side env only (STRIPE_SECRET_KEY, STRIPE_IDENTITY_WEBHOOK_SECRET) and
 * are never returned to the client or logged.
 *
 * SECURITY: we persist ONLY the session id (reference) + provider-verified DOB.
 * Raw documents/selfies/PII stay in Stripe and are never fetched into our store.
 */
export class StripeIdentityProvider implements KycProvider {
  readonly name = "stripe";

  async createSession(userId: string): Promise<KycSession> {
    const session = await getStripeServer().identity.verificationSessions.create(
      {
        type: "document",
        // Carries our user id back on every webhook event for this session.
        metadata: { uid: userId },
        options: { document: { require_matching_selfie: true } },
      },
    );
    if (!session.client_secret) {
      throw new Error("Stripe Identity session missing client_secret");
    }
    return { sessionId: session.id, clientSecretOrUrl: session.client_secret };
  }

  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): KycWebhookVerification {
    const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    if (!signatureHeader || !secret) return { valid: false, event: null };
    try {
      const event = getStripeServer().webhooks.constructEvent(
        rawBody,
        signatureHeader,
        secret,
      );
      return { valid: true, event };
    } catch {
      // Bad signature / malformed — caller rejects and does nothing.
      return { valid: false, event: null };
    }
  }

  async parseResult(event: unknown): Promise<KycParsedResult> {
    const e = event as Stripe.Event;
    const session = e.data.object as Stripe.Identity.VerificationSession;
    const userId = session.metadata?.uid ?? "";

    const status: KycResultStatus =
      e.type === "identity.verification_session.verified"
        ? "verified"
        : e.type === "identity.verification_session.processing"
          ? "pending"
          : // requires_input / canceled → the user must retry.
            "rejected";

    let verifiedDob: string | undefined;
    if (status === "verified") {
      // The raw event omits verified_outputs — retrieve with expand to read the
      // provider-verified DOB (the ONLY PII we persist).
      const full = await getStripeServer().identity.verificationSessions.retrieve(
        session.id,
        { expand: ["verified_outputs"] },
      );
      const dob = full.verified_outputs?.dob;
      if (dob && dob.year && dob.month && dob.day) {
        const mm = String(dob.month).padStart(2, "0");
        const dd = String(dob.day).padStart(2, "0");
        verifiedDob = `${dob.year}-${mm}-${dd}`;
      }
    }

    return {
      userId,
      status,
      referenceId: session.id,
      verifiedDob,
      eventId: e.id,
    };
  }
}
