import { adminDb } from "@/lib/firebase/admin";
import { getKycProvider } from "@/lib/kyc";
import { processKycWebhook } from "@/lib/kyc/webhook";

export const runtime = "nodejs";

/**
 * KYC provider webhook. The authoritative place kycStatus changes — never trust
 * the client. Requires the raw body for signature verification; an invalid or
 * unsigned request is rejected (400) and nothing is written. See
 * processKycWebhook for the fail-closed + idempotent logic.
 */
export async function POST(req: Request) {
  // Stripe Identity signs with `stripe-signature`; the mock provider uses
  // `x-kyc-signature`. Read the raw text BEFORE anything parses it.
  const signature =
    req.headers.get("stripe-signature") ?? req.headers.get("x-kyc-signature");
  const rawBody = await req.text();

  const outcome = await processKycWebhook({
    provider: getKycProvider(),
    rawBody,
    signature,
    db: adminDb(),
  });
  return Response.json(outcome.body, { status: outcome.status });
}
