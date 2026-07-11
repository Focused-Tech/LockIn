import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { evaluatePaidEntry } from "@/lib/eligibility";
import { MockKycProvider, simulateKycWebhook } from "./mock";
import { processKycWebhook, type UserWriteDb } from "./webhook";

/** DOB (YYYY-MM-DD) for someone who is `age` today (approx, Jan 1). */
function dobForAge(age: number): string {
  const now = new Date();
  return `${now.getFullYear() - age}-01-01`;
}
const ADULT = dobForAge(30);
const MINOR = dobForAge(15);

/** In-memory Firestore stub: get/set on user docs, counts writes. */
function makeDb(initial: Record<string, Record<string, unknown>>) {
  const store = new Map<string, Record<string, unknown>>(
    Object.entries(initial),
  );
  let setCount = 0;
  const db: UserWriteDb & {
    _get(id: string): Record<string, unknown> | undefined;
    _setCount(): number;
  } = {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
        set: async (data: unknown) => {
          setCount++;
          store.set(id, { ...(store.get(id) ?? {}), ...(data as object) });
          return undefined;
        },
      }),
    }),
    _get: (id) => store.get(id),
    _setCount: () => setCount,
  };
  return db;
}

// ── Phase 6 (a)–(d): the combined real-money gate ────────────────────────────
describe("evaluatePaidEntry — eligibility AND KYC", () => {
  it("(a) unverified but geo-eligible → blocked with kyc_required", () => {
    const r = evaluatePaidEntry({
      user: { kycStatus: "unverified", dateOfBirth: ADULT, kycVerifiedDob: null },
      jurisdictionKey: "US-TX",
    });
    expect(r).toMatchObject({ allowed: false, code: "kyc_required" });
  });

  it("(b) verified in an allowed state → allowed (age from PROVIDER dob)", () => {
    // Self-entered dob is a MINOR; provider-verified dob is an adult. Allowed
    // proves the age source switched to kycVerifiedDob.
    const r = evaluatePaidEntry({
      user: { kycStatus: "verified", dateOfBirth: MINOR, kycVerifiedDob: ADULT },
      jurisdictionKey: "US-TX",
    });
    expect(r).toEqual({ allowed: true });
  });

  it("(c) verified in a BLOCKED state → still blocked, not_eligible", () => {
    const r = evaluatePaidEntry({
      user: { kycStatus: "verified", dateOfBirth: ADULT, kycVerifiedDob: ADULT },
      jurisdictionKey: "US-CA",
    });
    expect(r).toMatchObject({
      allowed: false,
      code: "not_eligible",
      reason: "region_not_permitted",
    });
  });

  it("(d) rejected user → blocked with kyc_rejected", () => {
    const r = evaluatePaidEntry({
      user: { kycStatus: "rejected", dateOfBirth: ADULT, kycVerifiedDob: null },
      jurisdictionKey: "US-TX",
    });
    expect(r).toMatchObject({ allowed: false, code: "kyc_rejected" });
  });

  it("verified but no provider DOB → fail closed (not_eligible/no_dob)", () => {
    const r = evaluatePaidEntry({
      user: { kycStatus: "verified", dateOfBirth: ADULT, kycVerifiedDob: null },
      jurisdictionKey: "US-TX",
    });
    expect(r).toMatchObject({ allowed: false, code: "not_eligible", reason: "no_dob" });
  });
});

// ── Phase 6 (e)–(f): webhook signature + idempotency ─────────────────────────
describe("processKycWebhook", () => {
  const provider = new MockKycProvider();

  it("(e) bad signature → 400 and NOTHING changes", async () => {
    const { rawBody } = simulateKycWebhook({
      userId: "u1",
      status: "verified",
      verifiedDob: "1990-05-01",
    });
    const db = makeDb({ u1: { kycStatus: "pending", kycReferenceId: null } });
    const out = await processKycWebhook({
      provider,
      rawBody,
      signature: "tampered_signature",
      db,
    });
    expect(out.status).toBe(400);
    expect(db._setCount()).toBe(0);
    expect(db._get("u1")!.kycStatus).toBe("pending");
  });

  it("(f) duplicate delivery is idempotent (one effect)", async () => {
    const { rawBody, signature } = simulateKycWebhook({
      userId: "u1",
      status: "verified",
      referenceId: "ref_1",
      eventId: "evt_1",
      verifiedDob: "1990-05-01",
    });
    const db = makeDb({ u1: { kycStatus: "pending", kycReferenceId: null } });

    const first = await processKycWebhook({ provider, rawBody, signature, db });
    expect(first.body.applied).toBe(true);
    expect(db._get("u1")!.kycStatus).toBe("verified");
    expect(db._get("u1")!.kycVerifiedDob).toBe("1990-05-01");

    const second = await processKycWebhook({ provider, rawBody, signature, db });
    expect(second.body.idempotent).toBe(true);
    expect(db._setCount()).toBe(1); // exactly one write across both deliveries
  });

  it("rejected result is stored without a verified DOB", async () => {
    const { rawBody, signature } = simulateKycWebhook({
      userId: "u2",
      status: "rejected",
      referenceId: "ref_2",
    });
    const db = makeDb({ u2: { kycStatus: "pending", kycReferenceId: null } });
    const out = await processKycWebhook({ provider, rawBody, signature, db });
    expect(out.body).toMatchObject({ applied: true, status: "rejected" });
    expect(db._get("u2")!.kycStatus).toBe("rejected");
    expect(db._get("u2")!.kycVerifiedDob).toBeUndefined();
  });
});

// ── Phase 6 (g): practice/free entries never touch KYC ───────────────────────
describe("practice bypass (static guard)", () => {
  it("(g) the paid gate is reached ONLY behind the free-entry check", () => {
    const slate = readFileSync(
      resolve("src/app/app/slate/[id]/actions.ts"),
      "utf8",
    );
    // Jurisdiction (and thus the gate) is skipped for free entries, and the gate
    // call sits after the free-branch fork.
    expect(slate).toContain("evaluatePaidEntry");
    expect(slate).toContain("input.free");
    // The CALL (last occurrence, not the import) sits after the free-branch fork.
    expect(slate.lastIndexOf("evaluatePaidEntry")).toBeGreaterThan(
      slate.indexOf("if (input.free)"),
    );

    const parlay = readFileSync(
      resolve("src/components/cross-parlay/actions.ts"),
      "utf8",
    );
    expect(parlay).toContain("if (!input.free)");
    expect(parlay.lastIndexOf("evaluatePaidEntry")).toBeGreaterThan(
      parlay.indexOf("if (!input.free)"),
    );
  });
});
