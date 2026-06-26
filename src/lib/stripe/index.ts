import "server-only";
import Stripe from "stripe";

/**
 * Server-side Stripe client (PaymentIntents, Connect, Webhooks).
 *
 * Lazily constructed: instantiating at module load throws
 * "Neither apiKey nor config.authenticator provided" during `next build` page-
 * data collection, where STRIPE_SECRET_KEY isn't present. Call at request time.
 */
let client: Stripe | undefined;

export function getStripeServer(): Stripe {
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: { name: "LockIn", version: "0.1.0" },
  }));
}
