/**
 * AGE ENFORCEMENT — Henry handoff assignment 4. Before this, `minAge` was computed
 * (resolveEligibility) but nothing ever consulted it, and the social-login signup path could reach
 * an account with `dateOfBirth: ""` and no code path would ever notice. Both holes are closed inside
 * `verifyForCash` — the ONE gate every paid entry already runs through — rather than a second,
 * parallel check some call site could forget to add.
 */
import { describe, it, expect } from "vitest";
import { verifyForCash, PERJURY_ATTESTATION_TEXT, PERJURY_ATTESTATION_VERSION } from "./index";

const attestation = { affirmedState: "CA", acceptedAt: 0, text: PERJURY_ATTESTATION_TEXT, version: PERJURY_ATTESTATION_VERSION };

describe("age enforcement inside verifyForCash", () => {
  it("blocks an account with no date of birth on record — the no-DOB social-login path", () => {
    const v = verifyForCash({ ipState: "CA", addressState: "CA", attestation, dateOfBirth: null });
    expect(v).toMatchObject({ ok: false, reason: "no_dob" });
  });
  it("an empty-string DOB (exactly what src/app/api/auth/social/route.ts writes) fails the same way", () => {
    const v = verifyForCash({ ipState: "CA", addressState: "CA", attestation, dateOfBirth: "" });
    expect(v).toMatchObject({ ok: false, reason: "no_dob" });
  });
  it("blocks an account below the jurisdiction's minAge", () => {
    const seventeenYearsAgo = new Date();
    seventeenYearsAgo.setFullYear(seventeenYearsAgo.getFullYear() - 17);
    const dob = seventeenYearsAgo.toISOString().slice(0, 10);
    const v = verifyForCash({ ipState: "CA", addressState: "CA", attestation, dateOfBirth: dob });
    expect(v).toMatchObject({ ok: false, reason: "under_min_age" });
  });
  it("passes an account that clears the jurisdiction's minAge, everything else held equal", () => {
    const fortyYearsAgo = new Date();
    fortyYearsAgo.setFullYear(fortyYearsAgo.getFullYear() - 40);
    const dob = fortyYearsAgo.toISOString().slice(0, 10);
    const v = verifyForCash({ ipState: "CA", addressState: "CA", attestation, dateOfBirth: dob });
    expect(v.ok).toBe(true);
  });
  it("age is checked AFTER geo/attestation/cash-blocked — an unconfirmed location still fails no_location first", () => {
    const v = verifyForCash({ ipState: null, addressState: null, attestation, dateOfBirth: null });
    expect(v).toMatchObject({ ok: false, reason: "no_location" });
  });
});
