// Single source of truth for real-money eligibility (age + jurisdiction).
//
// This module is PURE and isomorphic — no `server-only`, no `next/headers` import
// — so both the server gate (which passes in request headers) and the client
// (which reuses the user-facing reason copy) can import it. The authoritative
// call always happens server-side in the entry actions.
//
// FAIL CLOSED: any path that cannot positively confirm age AND an allowed
// jurisdiction returns { eligible: false } with a specific reason. Practice
// (free) play never calls this and is available everywhere.
import { ageFromDob } from "@/lib/validation";
import type { KycStatus } from "@/lib/firebase/types";
import { ELIGIBILITY } from "./config";

/** Specific, machine-readable failure reasons. Never a generic "ineligible". */
export type EligibilityReason =
  | "eligible"
  | "no_dob" // no date of birth on file (e.g. social signup) — cannot verify age
  | "no_location" // Vercel geo headers absent — cannot verify jurisdiction
  | "region_not_permitted" // country/state not on the counsel allowlist
  | "under_min_age"; // age below the jurisdiction's minimum

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
  /** The jurisdiction's minimum age when known — used to build "21+" copy. */
  minAge?: number;
}

/** Minimal header bag — satisfied by both `Headers` and Next's ReadonlyHeaders. */
interface HeaderLike {
  get(name: string): string | null | undefined;
}

/**
 * Resolve the request's jurisdiction from Vercel geo headers into a "US-CA"
 * style key, or null when either the country or region is absent.
 *
 * STUB: Vercel IP geo is coarse. Production real-money legally requires a
 * certified geolocation provider (GeoComply-class). This interface is the swap
 * point — replace the body with the provider's verified region and the rest of
 * the gate is unchanged.
 */
export function getJurisdiction(headers: HeaderLike): string | null {
  const country = (headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase();
  const region = (headers.get("x-vercel-ip-country-region") ?? "")
    .trim()
    .toUpperCase();
  if (!country || !region) return null;
  return `${country}-${region}`;
}

/**
 * THE single source of truth for whether a user may play for real money.
 *
 * Returns eligible only when: a jurisdiction is known, its country + region are
 * on the counsel allowlist with status "allow", a DOB is on file, and the age
 * meets that jurisdiction's minimum. Every other outcome is a specific,
 * fail-closed rejection.
 */
export function isRealMoneyEligible({
  dob,
  jurisdictionKey,
}: {
  dob: string | null | undefined;
  jurisdictionKey: string | null;
}): EligibilityResult {
  // No location → cannot confirm jurisdiction. Fail closed.
  if (!jurisdictionKey) {
    return { eligible: false, reason: "no_location" };
  }

  const [country, region] = jurisdictionKey.split("-");
  if (
    !country ||
    !region ||
    !(ELIGIBILITY.allowedCountries as readonly string[]).includes(country)
  ) {
    return { eligible: false, reason: "region_not_permitted" };
  }

  const entry = (ELIGIBILITY.states as Record<
    string,
    { status: string; minAge: number }
  >)[region];
  if (!entry || entry.status !== "allow") {
    return { eligible: false, reason: "region_not_permitted" };
  }

  // Jurisdiction is permitted — now confirm age. No DOB → cannot verify. Fail closed.
  if (!dob) {
    return { eligible: false, reason: "no_dob", minAge: entry.minAge };
  }

  const age = ageFromDob(dob);
  if (!Number.isFinite(age) || age < entry.minAge) {
    return { eligible: false, reason: "under_min_age", minAge: entry.minAge };
  }

  return { eligible: true, reason: "eligible", minAge: entry.minAge };
}

/**
 * User-facing copy for a rejection reason. Shared by the server actions and the
 * client so the message is identical everywhere. Never silent — always specific.
 */
export function eligibilityMessage(result: EligibilityResult): string {
  switch (result.reason) {
    case "no_location":
      return "We couldn't confirm your location, so real-money play is unavailable. You can still play the practice version.";
    case "region_not_permitted":
      return "Real-money play isn't available in your location. You can still play the practice version.";
    case "no_dob":
      return "Add your date of birth to your account to play for real money. Practice play is open to you now.";
    case "under_min_age":
      return `You must be ${result.minAge ?? 18}+ to play for money here. You can still play the practice version.`;
    case "eligible":
      return "";
  }
}

// ── Real-money gate: eligibility (geo+age) AND identity verification (KYC) ─────

/** User-facing copy for the two KYC outcomes. Specific — never silent. */
export const KYC_REQUIRED_MESSAGE =
  "Verify your identity to play for real money. You can play the practice version now.";
export const KYC_REJECTED_MESSAGE =
  "We couldn't verify your identity. Try verifying again, or play the practice version.";

/** Distinct blocked outcomes so the client can react specifically. */
export type PaidGateCode = "not_eligible" | "kyc_required" | "kyc_rejected";

export type PaidGateResult =
  | { allowed: true }
  | {
      allowed: false;
      code: PaidGateCode;
      /** Present for not_eligible (the geo/age reason). */
      reason?: EligibilityReason;
      message: string;
      minAge?: number;
    };

/** Minimal user shape the paid gate needs (decouples from the full UserDoc). */
export interface PaidGateUser {
  kycStatus: KycStatus;
  dateOfBirth: string | null | undefined;
  kycVerifiedDob: string | null | undefined;
  /** Architect/admin override — real-money always allowed, no verification. */
  isArchitect?: boolean;
  isAdmin?: boolean;
  /** Pre-KYC out-of-band verification signal (grandfathering). */
  creatorVerified?: boolean;
}

/**
 * Architect/admin override: these accounts are real-money allowed and must NEVER
 * be routed into geo/age/KYC (or, in PART B, tax/AML) verification. Checked
 * before any other gate logic.
 */
export function isOverrideAccount(user: {
  isArchitect?: boolean;
  isAdmin?: boolean;
}): boolean {
  return user.isArchitect === true || user.isAdmin === true;
}

/**
 * Whether a user counts as identity-verified for gating, INCLUDING the
 * grandfather rule: live pre-KYC accounts already verified out-of-band
 * (creatorVerified) are not re-verified. Override accounts are always verified.
 */
export function isEffectivelyKycVerified(user: {
  kycStatus?: KycStatus;
  creatorVerified?: boolean;
  isArchitect?: boolean;
  isAdmin?: boolean;
}): boolean {
  if (isOverrideAccount(user)) return true;
  if (user.kycStatus === "verified") return true;
  // Grandfather: live pre-KYC accounts already verified out-of-band.
  return (
    user.creatorVerified === true &&
    (!user.kycStatus || user.kycStatus === "unverified")
  );
}

/**
 * THE real-money gate. A PAID entry is allowed ONLY when BOTH hold:
 *   1) isRealMoneyEligible === true (jurisdiction + age), AND
 *   2) kycStatus === "verified".
 * Every other outcome is a specific, fail-closed block. Practice (free) entries
 * must NOT call this.
 *
 * Order: eligibility (geo/age) is checked first and is independent of KYC — a
 * user in a blocked region is not_eligible regardless of verification. Only when
 * geo/age passes do we require identity verification.
 */
export function evaluatePaidEntry({
  user,
  jurisdictionKey,
}: {
  user: PaidGateUser;
  jurisdictionKey: string | null;
}): PaidGateResult {
  // OVERRIDE (checked BEFORE any geo/age/KYC logic): architect/admin accounts are
  // always allowed and are never routed into verification.
  if (isOverrideAccount(user)) return { allowed: true };

  // Grandfather: live pre-KYC accounts already verified out-of-band are not
  // re-verified. A creatorVerified account whose kycStatus is absent/unverified
  // is treated as verified for gating (but keeps using its self-entered DOB,
  // since no provider-verified DOB exists for it).
  const grandfathered =
    user.creatorVerified === true &&
    (!user.kycStatus || user.kycStatus === "unverified");
  const genuinelyVerified = user.kycStatus === "verified";
  const kycVerified = genuinelyVerified || grandfathered;

  // AGE SOURCE SWITCH: a genuinely KYC-verified user's age comes from the
  // PROVIDER-verified DOB (kycVerifiedDob) — NOT the self-entered signup DOB, and
  // fail-closed if it's missing. Grandfathered and pre-KYC users fall back to the
  // self-entered DOB. This is the exact switch line.
  const effectiveDob = genuinelyVerified
    ? user.kycVerifiedDob
    : user.dateOfBirth;

  // 1) Jurisdiction + age.
  const elig = isRealMoneyEligible({ dob: effectiveDob, jurisdictionKey });
  if (!elig.eligible) {
    return {
      allowed: false,
      code: "not_eligible",
      reason: elig.reason,
      message: eligibilityMessage(elig),
      minAge: elig.minAge,
    };
  }

  // 2) Identity verification (provider-authoritative).
  if (kycVerified) return { allowed: true };
  if (user.kycStatus === "rejected") {
    return { allowed: false, code: "kyc_rejected", message: KYC_REJECTED_MESSAGE };
  }
  // "unverified" | "pending" → must complete verification.
  return { allowed: false, code: "kyc_required", message: KYC_REQUIRED_MESSAGE };
}
