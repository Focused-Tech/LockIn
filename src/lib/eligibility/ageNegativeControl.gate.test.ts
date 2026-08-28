/**
 * AGE ENFORCEMENT — NEGATIVE CONTROL (Frank's ruling, LOCKIN_HENRY_RESPONSE_2026-08-27_v2 §1).
 *
 * The earlier evidence (ageEnforcement.gate.test.ts) only ever tested against 18 — with
 * STATE_MIN_AGE empty, every state resolves to DEFAULT_MIN_AGE (18), so a hardcoded `18` would have
 * passed those same three cases identically. That proves nothing about whether the comparison
 * actually reads the STATE's minimum, which is the entire point of the ruling.
 *
 * This test mocks `@/lib/contest/architectSet` to temporarily give ONE state a 21 minimum, entirely
 * inside this test's module registry — it never edits the real file, so STATE_MIN_AGE stays the
 * empty `{}` Frank ruled it should stay (asserted below). `vi.resetModules()` + a fresh dynamic
 * import is required because `STATE_CONFIG` (states.ts) computes each state's minAge ONCE at module
 * load from STATE_MIN_AGE, so the override has to be in place before that module is first evaluated.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PerjuryAttestation } from "./index";

const attestation = (state: string): PerjuryAttestation => ({
  affirmedState: state,
  acceptedAt: 0,
  text: "x",
  version: "v1",
});

const dobForAge = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

afterEach(() => {
  vi.doUnmock("@/lib/contest/architectSet");
  vi.resetModules();
});

describe("the comparison reads the resolving STATE's minimum, not a hardcoded 18", () => {
  it("a 19-year-old is REFUSED in a state temporarily overridden to 21", async () => {
    vi.resetModules();
    vi.doMock("@/lib/contest/architectSet", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../contest/architectSet")>();
      return { ...actual, STATE_MIN_AGE: { TX: 21 } };
    });
    const { verifyForCash } = await import("./index");

    const dob = dobForAge(19);
    const verdict = verifyForCash({
      ipState: "TX",
      addressState: "TX",
      attestation: attestation("TX"),
      dateOfBirth: dob,
    });
    console.log("[negative control] 19yo, TX temporarily overridden to minAge 21 →", verdict);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe("under_min_age");
      expect(verdict.detail).toContain("21");
    }
  });

  it("the SAME 19-year-old PASSES in an 18-state, under the identical override — same DOB, different state, different outcome", async () => {
    vi.resetModules();
    vi.doMock("@/lib/contest/architectSet", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../contest/architectSet")>();
      return { ...actual, STATE_MIN_AGE: { TX: 21 } }; // CO is untouched by the override → falls through to DEFAULT_MIN_AGE (18)
    });
    const { verifyForCash } = await import("./index");

    const dob = dobForAge(19); // identical DOB to the refused case above
    const verdict = verifyForCash({
      ipState: "CO",
      addressState: "CO",
      attestation: attestation("CO"),
      dateOfBirth: dob,
    });
    console.log("[negative control] SAME 19yo dob, CO (18-state, untouched by the override) →", verdict);
    expect(verdict.ok).toBe(true);
  });

  it("the real STATE_MIN_AGE table is untouched by any of the above — still the empty {} Frank ruled", async () => {
    const { STATE_MIN_AGE } = await import("@/lib/contest/architectSet");
    expect(STATE_MIN_AGE).toEqual({});
  });
});
