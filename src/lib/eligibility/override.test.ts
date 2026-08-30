import { describe, it, expect } from "vitest";
import { evaluatePaidEntry, isOverrideAccount } from "./index";

function dobForAge(age: number): string {
  const now = new Date();
  return `${now.getFullYear() - age}-01-01`;
}
const ADULT = dobForAge(30);

describe("PART A — architect/admin override + grandfather", () => {
  it("admin in a BLOCKED state with UNVERIFIED kyc is still ALLOWED (never sent to KYC)", () => {
    const r = evaluatePaidEntry({
      user: {
        kycStatus: "unverified",
        dateOfBirth: null,
        kycVerifiedDob: null,
        isAdmin: true,
      },
      jurisdictionKey: "US-CA", // block_pickem
    });
    expect(r).toEqual({ allowed: true });
  });

  it("architect with no location AND no dob is ALLOWED (override runs before everything)", () => {
    const r = evaluatePaidEntry({
      user: {
        kycStatus: "unverified",
        dateOfBirth: null,
        kycVerifiedDob: null,
        isArchitect: true,
      },
      jurisdictionKey: null,
    });
    expect(r).toEqual({ allowed: true });
  });

  it("creatorVerified with no KYC is treated verified — allowed, not kyc_required", () => {
    const r = evaluatePaidEntry({
      user: {
        kycStatus: "unverified",
        dateOfBirth: ADULT,
        kycVerifiedDob: null,
        creatorVerified: true,
      },
      jurisdictionKey: "US-TX",
    });
    expect(r).toEqual({ allowed: true });
  });

  it("grandfather does NOT rescue a blocked jurisdiction (eligibility stays independent)", () => {
    const r = evaluatePaidEntry({
      user: {
        kycStatus: "unverified",
        dateOfBirth: ADULT,
        kycVerifiedDob: null,
        creatorVerified: true,
      },
      jurisdictionKey: "US-CA",
    });
    expect(r).toMatchObject({ allowed: false, code: "not_eligible" });
  });

  it("a normal stranger (no override, unverified) still gets kyc_required", () => {
    const r = evaluatePaidEntry({
      user: { kycStatus: "unverified", dateOfBirth: ADULT, kycVerifiedDob: null },
      jurisdictionKey: "US-TX",
    });
    expect(r).toMatchObject({ allowed: false, code: "kyc_required" });
  });

  it("isOverrideAccount matches admin/architect only", () => {
    expect(isOverrideAccount({ isAdmin: true })).toBe(true);
    expect(isOverrideAccount({ isArchitect: true })).toBe(true);
    expect(isOverrideAccount({})).toBe(false);
  });
});
