/**
 * REAL IDENTITY VERIFICATION — Henry handoff assignment 3. Replaces the mock (~3s setTimeout, fake
 * `mock_persona_*` id, instant "verified") with Stripe Identity, the ruled provider. verifyIdentity
 * now only OPENS a VerificationSession and sets kycStatus "pending"; the webhook resolves it to
 * "verified"/"failed" once Stripe finishes reviewing the document + selfie asynchronously.
 *
 * Both touched files import adminDb/getStripeServer at module scope in a way vitest can't safely
 * execute (no live Firebase/Stripe creds in CI), so this follows the repo's existing source-read gate
 * pattern (see contest/rakeSwap.gate.test.ts) rather than calling the actions directly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("the mock is gone", () => {
  it("no fabricated provider id, no simulated round-trip, no instant verified", () => {
    const src = read("src/app/onboarding/actions.ts");
    expect(src).not.toContain("mock_persona_");
    expect(src).not.toContain("setTimeout");
    expect(src).not.toContain('kycStatus: "verified"');
  });
  it("the SSN is still never persisted (kept behaviour, per the handoff)", () => {
    const src = read("src/app/onboarding/actions.ts");
    expect(src).not.toMatch(/ssnLast4\s*[,:]\s*(input\.)?ssnLast4/);
  });
});

describe("verifyIdentity opens a real Stripe Identity session", () => {
  const src = read("src/app/onboarding/actions.ts");
  it("creates a document + selfie verification session and stores it as pending", () => {
    expect(src).toContain("identity.verificationSessions.create");
    expect(src).toContain('type: "document"');
    expect(src).toContain("require_matching_selfie: true");
    expect(src).toContain('kycStatus: "pending"');
    expect(src).toContain("kycProviderId: session.id");
  });
  it("returns the client_secret so the client can launch Stripe's own hosted modal", () => {
    expect(src).toContain("clientSecret: session.client_secret");
  });
});

describe("the webhook resolves pending → verified/failed", () => {
  const src = read("src/app/api/webhooks/stripe/route.ts");
  it("listens for all three terminal Identity events", () => {
    expect(src).toContain('"identity.verification_session.verified"');
    expect(src).toContain('"identity.verification_session.requires_input"');
    expect(src).toContain('"identity.verification_session.canceled"');
  });
  it("both handlers guard on kycStatus === \"pending\" + a matching session id (no stale/duplicate flips)", () => {
    for (const fn of ["completeIdentityVerification", "failIdentityVerification"]) {
      const start = src.indexOf(`async function ${fn}`);
      expect(start).toBeGreaterThan(-1);
      const body = src.slice(start, start + 500);
      expect(body).toContain('user.kycStatus !== "pending"');
      expect(body).toContain("user.kycProviderId !== session.id");
    }
  });
  it("a failed/canceled session sets kycStatus to failed, not none — payout stays blocked either way", () => {
    const start = src.indexOf("async function failIdentityVerification");
    expect(src.slice(start, start + 500)).toContain('kycStatus: "failed"');
  });
});

describe("payout still gates on kycStatus === \"verified\" — unchanged, benefits automatically", () => {
  it("requestWithdrawal's KYC check reads the same field this assignment now sets accurately", () => {
    expect(read("src/app/app/wallet/actions.ts")).toContain('user.kycStatus !== "verified"');
  });
});
