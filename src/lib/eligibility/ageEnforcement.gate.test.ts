/**
 * AGE ENFORCEMENT (Henry handoff assignment 4, ruled 2026-08-27) — evidence that the per-entry check
 * is a LOCAL date comparison: no network call, no vendor request, no Stripe hit. This file makes no
 * mocks for fetch/Stripe/any HTTP client — if `verifyForCash` ever reached out to one, this test would
 * hang or throw in CI rather than pass, so a clean pass is itself part of the proof. The comparison
 * itself is `ageFromDob(dateOfBirth) < eligibility.minAge` at src/lib/eligibility/index.ts:166,
 * `ageFromDob` (pure Date arithmetic, no imports beyond a constant) at src/lib/validation.ts:5.
 */
import { describe, it, expect } from "vitest";
import { verifyForCash, type VerificationInputs } from "./index";

const validNonAge: Omit<VerificationInputs, "dateOfBirth"> = {
  ipState: "TX", // cashAllowed, not in RESTRICTED_FORMAT — a clean lane isolating the age check
  addressState: "TX",
  attestation: { affirmedState: "TX", acceptedAt: 0, text: "x", version: "v1" },
};

describe("age enforcement runs on every cash entry, locally, off the date of birth already on file", () => {
  it("REFUSES an under-age account — TX minAge is 18 (DEFAULT_MIN_AGE; STATE_MIN_AGE is still empty, per Frank's ruling)", () => {
    const seventeen = new Date();
    seventeen.setFullYear(seventeen.getFullYear() - 17);
    const dob = seventeen.toISOString().slice(0, 10);

    const verdict = verifyForCash({ ...validNonAge, dateOfBirth: dob });
    console.log("[age enforcement] 17-year-old, TX, cash entry attempt →", verdict);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe("under_min_age");
      expect(verdict.detail).toContain("18");
    }
  });

  it("REFUSES the no-DOB social-login path (src/app/api/auth/social/route.ts writes an empty string)", () => {
    const verdict = verifyForCash({ ...validNonAge, dateOfBirth: "" });
    console.log("[age enforcement] empty date of birth (social signup), TX, cash entry attempt →", verdict);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("no_dob");
  });

  it("ALLOWS an 18-year-old — the same shape, one field changed, to prove this isn't failing for an unrelated reason", () => {
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    eighteen.setDate(eighteen.getDate() - 1); // yesterday was the 18th birthday — already 18 today
    const dob = eighteen.toISOString().slice(0, 10);

    const verdict = verifyForCash({ ...validNonAge, dateOfBirth: dob });
    console.log("[age enforcement] 18-year-old (birthday was yesterday), TX, cash entry attempt →", verdict);
    expect(verdict.ok).toBe(true);
  });

  it("is arithmetic against a stored value, not a network call — the empty-mocks environment above is the proof; this just names the two lines", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/lib/eligibility/index.ts"), "utf8");
    expect(src).toContain("ageFromDob(dateOfBirth) < eligibility.minAge");
    expect(src).not.toMatch(/fetch\(|axios|http\.|https\./);
    const validationSrc = readFileSync(resolve(process.cwd(), "src/lib/validation.ts"), "utf8");
    const start = validationSrc.indexOf("export function ageFromDob");
    const body = validationSrc.slice(start, start + 400);
    expect(body).not.toMatch(/fetch\(|axios|http\.|https\./);
  });
});
