import { describe, it, expect } from "vitest";
import { getJurisdiction, isRealMoneyEligible } from "./index";

/** A header bag stub matching the { get } shape getJurisdiction reads. */
function hdrs(map: Record<string, string>) {
  return { get: (k: string) => map[k] ?? null };
}

/** DOB (YYYY-MM-DD) for someone who is exactly `age` today (approx, mid-year). */
function dobForAge(age: number): string {
  const now = new Date();
  return `${now.getFullYear() - age}-01-01`;
}

describe("getJurisdiction", () => {
  it("builds a US-CA style key from Vercel geo headers", () => {
    expect(
      getJurisdiction(
        hdrs({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "TX" }),
      ),
    ).toBe("US-TX");
  });

  it("returns null when the region header is missing (fail closed)", () => {
    expect(getJurisdiction(hdrs({ "x-vercel-ip-country": "US" }))).toBeNull();
  });

  it("returns null when headers are entirely stripped (fail closed)", () => {
    expect(getJurisdiction(hdrs({}))).toBeNull();
  });
});

describe("isRealMoneyEligible", () => {
  const adult = dobForAge(30);

  it("ALLOWS an adult in a permitted state (TX, 18+)", () => {
    const r = isRealMoneyEligible({ dob: adult, jurisdictionKey: "US-TX" });
    expect(r).toMatchObject({ eligible: true, reason: "eligible" });
  });

  it("BLOCKS a non-allowlisted state with region_not_permitted (CA)", () => {
    const r = isRealMoneyEligible({ dob: adult, jurisdictionKey: "US-CA" });
    expect(r).toMatchObject({ eligible: false, reason: "region_not_permitted" });
  });

  it("BLOCKS when location is unknown with no_location (headers stripped)", () => {
    const r = isRealMoneyEligible({ dob: adult, jurisdictionKey: null });
    expect(r).toMatchObject({ eligible: false, reason: "no_location" });
  });

  it("BLOCKS a non-US country with region_not_permitted", () => {
    const r = isRealMoneyEligible({ dob: adult, jurisdictionKey: "CA-ON" });
    expect(r).toMatchObject({ eligible: false, reason: "region_not_permitted" });
  });

  it("BLOCKS when no DOB is on file with no_dob (social signup)", () => {
    expect(
      isRealMoneyEligible({ dob: "", jurisdictionKey: "US-TX" }),
    ).toMatchObject({ eligible: false, reason: "no_dob" });
    expect(
      isRealMoneyEligible({ dob: null, jurisdictionKey: "US-TX" }),
    ).toMatchObject({ eligible: false, reason: "no_dob" });
  });

  it("enforces the per-jurisdiction minimum age (MA is 21)", () => {
    expect(
      isRealMoneyEligible({ dob: dobForAge(20), jurisdictionKey: "US-MA" }),
    ).toMatchObject({ eligible: false, reason: "under_min_age", minAge: 21 });
    expect(
      isRealMoneyEligible({ dob: dobForAge(21), jurisdictionKey: "US-MA" }),
    ).toMatchObject({ eligible: true });
  });

  it("under 18 is blocked even in an 18+ state", () => {
    expect(
      isRealMoneyEligible({ dob: dobForAge(17), jurisdictionKey: "US-TX" }),
    ).toMatchObject({ eligible: false, reason: "under_min_age" });
  });
});
