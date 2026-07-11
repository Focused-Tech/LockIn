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
