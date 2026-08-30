// SWAP-POINT: swap the concrete provider without touching callers.
//
// Every KYC caller (the start-session action, the webhook route, the gate) talks
// ONLY to this interface. To change vendor, implement KycProvider once and select
// it in ./index — no caller changes. Mirrors the eligibility/geo swap-point.
//
// SECURITY: implementations read provider secrets from SERVER-SIDE env only and
// must never return or log raw PII (ID images, document numbers, SSN). The only
// result they surface is: status + provider reference id + provider-verified DOB.

/** Normalized verification status, provider-independent. */
export type KycResultStatus = "verified" | "pending" | "rejected";

/** What createSession hands back for the client to launch the provider flow. */
export interface KycSession {
  sessionId: string;
  /** Stripe Identity → client_secret; URL-based providers → a hosted URL. */
  clientSecretOrUrl: string;
}

/** Result of verifying a raw webhook payload's signature. */
export interface KycWebhookVerification {
  valid: boolean;
  /** The parsed provider event — ONLY trustworthy when valid === true. */
  event: unknown;
}

/** Normalized, PII-free result parsed from a verified webhook event. */
export interface KycParsedResult {
  /** Our user id (carried via provider session metadata). */
  userId: string;
  status: KycResultStatus;
  /** Provider's session/verification reference id (safe to store). */
  referenceId: string;
  /** Provider-VERIFIED date of birth (YYYY-MM-DD), when the provider returns it. */
  verifiedDob?: string;
  /** Idempotency key — the provider event id (same delivery twice = one effect). */
  eventId: string;
}

/** Provider-agnostic KYC contract. Implemented once per vendor. */
export interface KycProvider {
  /** Short provider name persisted on the user doc (e.g. "stripe" | "mock"). */
  readonly name: string;
  /** Create a verification session for a user; sets nothing in our DB. */
  createSession(userId: string): Promise<KycSession>;
  /** Verify a raw webhook body's signature. NEVER trust an event when invalid. */
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): KycWebhookVerification;
  /**
   * Parse a VERIFIED event into a normalized, PII-free result. Async because
   * some providers (Stripe Identity) require an API round-trip to retrieve the
   * provider-verified outputs (DOB) that the raw event omits.
   */
  parseResult(event: unknown): Promise<KycParsedResult>;
}
