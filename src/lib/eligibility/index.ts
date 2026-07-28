/**
 * SLICE 1.2–1.5 — THE ONE ELIGIBILITY RESOLVER.
 *
 * Every gate — player entry, creator hosting, signup — calls `resolveEligibility`. No scattered
 * conditionals anywhere else. Slice 1.4: gate BOTH sides; creator hosting is the STRICTER gate
 * because operator exposure sits with LockIn.
 */
import {
  STATE_CONFIG,
  CASH_BLOCK_REASON,
  type StateCode,
  type FormatTier,
  type StateConfig,
} from "./states";

export type { StateCode, FormatTier, StateConfig } from "./states";
export { STATE_CONFIG } from "./states";

/** NCPG line reused across responsible-play surfaces. */
export const CONTACT_REP_LINE =
  "Paid contests are a state-by-state decision. Ask your state representative to support licensed skill-based contests.";

export interface Eligibility {
  state: StateCode | null;
  /** Real-money entry allowed for a PLAYER in this state. */
  canPlayCash: boolean;
  /** Real-money HOSTING allowed for a CREATOR in this state (the stricter gate). */
  canHostCash: boolean;
  /** Coins are available everywhere — free play is never blocked by geography. */
  canPlayCoins: true;
  formatTier: FormatTier;
  collegeSportsAllowed: boolean;
  minAge: number;
  /** Present when cash is blocked — the state-law note for the signup message (slice 1.5). */
  cashBlockReason: string | null;
}

/**
 * Resolve a state code into the full eligibility picture. Unknown / absent state → cash locked on
 * both sides (fail closed), coins still available. This is the ONLY place these rules live.
 */
export function resolveEligibility(state: string | null | undefined): Eligibility {
  const code = (state ?? "").toUpperCase() as StateCode;
  const cfg: StateConfig | undefined = STATE_CONFIG[code];
  if (!cfg) {
    return {
      state: null,
      canPlayCash: false,
      canHostCash: false,
      canPlayCoins: true,
      formatTier: "restricted", // fail closed to the tighter pool when jurisdiction is unknown
      collegeSportsAllowed: false,
      minAge: 21,
      cashBlockReason: "We can't confirm your state, so paid play is unavailable. Coins work everywhere.",
    };
  }
  return {
    state: code,
    canPlayCash: cfg.cashAllowed,
    // Hosting is the stricter side: a creator must be cash-eligible to host at all. If cash-hosting
    // rules ever diverge from player rules, tighten HERE — never in a call site.
    canHostCash: cfg.cashAllowed,
    canPlayCoins: true,
    formatTier: cfg.formatTier,
    collegeSportsAllowed: cfg.collegeSportsAllowed,
    minAge: cfg.minAge,
    cashBlockReason: cfg.cashAllowed ? null : CASH_BLOCK_REASON[code] ?? "Paid contests aren't available in your state yet.",
  };
}

/** SLICE 1.4 — player-side gate. A player in a blocked state cannot ENTER a cash contest. */
export function canPlayerEnterCash(state: string | null | undefined): boolean {
  return resolveEligibility(state).canPlayCash;
}

/** SLICE 1.4 — creator-side gate (stricter). A creator in a blocked state cannot HOST a cash slate. */
export function canCreatorHostCash(state: string | null | undefined): boolean {
  return resolveEligibility(state).canHostCash;
}

/**
 * SLICE 1.5 — blocked-state signup copy. Names the state law, offers the coin product, and always
 * includes a contact-your-representative line. NEVER a dead end.
 */
export function blockedStateMessage(state: string | null | undefined): {
  title: string;
  law: string;
  coinOffer: string;
  contact: string;
} {
  const e = resolveEligibility(state);
  return {
    title: e.state ? `Paid contests aren't available in ${e.state} yet` : "We couldn't confirm your state",
    law: e.cashBlockReason ?? "Paid contests aren't available in your state yet.",
    coinOffer: "You can still play the full game with coins — free, everywhere, no cash required.",
    contact: CONTACT_REP_LINE,
  };
}

/**
 * SLICE 1.3 — VERIFICATION STACK (no paid geofencing vendor). Real-money eligibility requires ALL
 * of: an IP-geolocation read (MaxMind-class), a registered address on file, and a digitally
 * accepted penalty-of-perjury attestation. ID upload is required ONLY where a payout threshold
 * forces KYC (checked at withdrawal, not here).
 */
export interface VerificationInputs {
  /** State from IP geolocation (MaxMind-class lookup). */
  ipState: string | null;
  /** State from the user's registered address on file. */
  addressState: string | null;
  /** The signed penalty-of-perjury attestation (slice 1.3), or null if not accepted. */
  attestation: PerjuryAttestation | null;
}

export interface PerjuryAttestation {
  /** The state the user affirmed, under penalty of perjury, as their residence. */
  affirmedState: string;
  /** epoch ms of digital acceptance. */
  acceptedAt: number;
  /** the exact text the user accepted (kept for the record). */
  text: string;
  version: string;
}

export const PERJURY_ATTESTATION_TEXT =
  "I affirm, under penalty of perjury, that the state of residence I have provided is true and " +
  "correct, and I accept liability for any false statement.";
export const PERJURY_ATTESTATION_VERSION = "v1";

export type VerificationResult =
  | { ok: true; state: StateCode; eligibility: Eligibility }
  | { ok: false; reason: "no_location" | "address_mismatch" | "no_attestation" | "cash_blocked"; detail: string };

/**
 * Resolve the real-money verification stack. Fails CLOSED with a specific reason. Callers surface
 * the reason on screen (no silent catch).
 */
export function verifyForCash(inputs: VerificationInputs): VerificationResult {
  const { ipState, addressState, attestation } = inputs;
  if (!ipState) return { ok: false, reason: "no_location", detail: "We couldn't read your location. Paid play needs a confirmed state." };
  if (!attestation) return { ok: false, reason: "no_attestation", detail: "You must accept the residence attestation to play for cash." };
  // IP geo and the registered address must agree on the state — a cheap, vendor-free cross-check.
  if (addressState && ipState.toUpperCase() !== addressState.toUpperCase()) {
    return { ok: false, reason: "address_mismatch", detail: `Your location (${ipState}) doesn't match your address on file (${addressState}).` };
  }
  const eligibility = resolveEligibility(ipState);
  if (!eligibility.canPlayCash || !eligibility.state) {
    return { ok: false, reason: "cash_blocked", detail: eligibility.cashBlockReason ?? "Paid contests aren't available in your state." };
  }
  return { ok: true, state: eligibility.state, eligibility };
}
