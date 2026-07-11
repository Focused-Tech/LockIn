import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  KycParsedResult,
  KycProvider,
  KycResultStatus,
  KycSession,
  KycWebhookVerification,
} from "./types";

/**
 * MockKycProvider — local/dev/test provider with NO network. Webhook payloads
 * are signed with a real HMAC so signature verification (and its failure path)
 * is exercised exactly like production. Selected when KYC_PROVIDER=mock or when
 * no real provider key is present, so local dev fails closed to practice rather
 * than crashing on a missing Stripe key.
 */
function mockSecret(): string {
  return process.env.KYC_MOCK_WEBHOOK_SECRET || "mock_webhook_secret";
}

function sign(rawBody: string): string {
  return createHmac("sha256", mockSecret()).update(rawBody).digest("hex");
}

interface MockEvent {
  id: string;
  userId: string;
  status: KycResultStatus;
  referenceId: string;
  verifiedDob?: string;
}

export class MockKycProvider implements KycProvider {
  readonly name = "mock";

  async createSession(userId: string): Promise<KycSession> {
    const sessionId = `mock_sess_${userId}_${Date.now()}`;
    return { sessionId, clientSecretOrUrl: `mock://verify/${sessionId}` };
  }

  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
  ): KycWebhookVerification {
    if (!signatureHeader) return { valid: false, event: null };
    const expected = sign(rawBody);
    // Constant-time compare; length mismatch (tampered) → invalid, never throws.
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, event: null };
    }
    try {
      return { valid: true, event: JSON.parse(rawBody) as MockEvent };
    } catch {
      return { valid: false, event: null };
    }
  }

  async parseResult(event: unknown): Promise<KycParsedResult> {
    const e = event as MockEvent;
    return {
      userId: e.userId,
      status: e.status,
      referenceId: e.referenceId,
      verifiedDob: e.verifiedDob,
      eventId: e.id,
    };
  }
}

/**
 * TEST/DEV HELPER — build a signed mock webhook (rawBody + signature) that the
 * webhook route accepts, simulating a verified/pending/rejected result. Not used
 * in production paths.
 */
export function simulateKycWebhook(input: {
  userId: string;
  status: KycResultStatus;
  referenceId?: string;
  verifiedDob?: string;
  eventId?: string;
}): { rawBody: string; signature: string } {
  const event: MockEvent = {
    id: input.eventId ?? `evt_${input.userId}_${input.status}`,
    userId: input.userId,
    status: input.status,
    referenceId: input.referenceId ?? `mock_ref_${input.userId}`,
    verifiedDob: input.verifiedDob,
  };
  const rawBody = JSON.stringify(event);
  return { rawBody, signature: sign(rawBody) };
}
