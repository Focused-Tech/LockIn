// SWAP-POINT: swap the concrete provider without touching callers.
//
// Callers use getKycProvider() and the KycProvider interface only. Change vendor
// here (or via the KYC_PROVIDER env) and nothing else moves.
import type { KycProvider } from "./types";
import { MockKycProvider } from "./mock";
import { StripeIdentityProvider } from "./stripe";

export type { KycProvider } from "./types";
export type {
  KycParsedResult,
  KycResultStatus,
  KycSession,
  KycWebhookVerification,
} from "./types";
export { simulateKycWebhook, MockKycProvider } from "./mock";

/**
 * Select the active KYC provider.
 *  - KYC_PROVIDER=stripe → Stripe Identity
 *  - KYC_PROVIDER=mock   → Mock (no network)
 *  - unset → Stripe ONLY when its keys are present; otherwise Mock, so local dev
 *    fails closed to practice (never crashes on a missing Stripe key).
 *
 * FAIL CLOSED: an unknown KYC_PROVIDER value is treated as mock (dev), never as
 * an implicitly-trusting real provider.
 */
export function getKycProvider(): KycProvider {
  const choice = (process.env.KYC_PROVIDER || "").trim().toLowerCase();
  if (choice === "stripe") return new StripeIdentityProvider();
  if (choice === "mock") return new MockKycProvider();

  if (
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET
  ) {
    return new StripeIdentityProvider();
  }
  return new MockKycProvider();
}
