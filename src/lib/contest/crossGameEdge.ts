/**
 * CROSS-GAME EDGE POLICY (§2.4) — ONE place for the three edge cases that decide who gets paid.
 * These affect money, so each is the MOST CONSERVATIVE behaviour available and is LABELLED as my
 * read for the architect to overrule. Do not scatter these rules — every archetype resolver routes
 * its eligibility through here.
 *
 * POLICIES (my conservative read — architect may overrule):
 *  1. POSTPONED / SUSPENDED game on ANY named option  → VOID the leg (push → refund). A leg cannot
 *     fairly resolve when one of its games didn't happen.
 *  2. A named player DID NOT PLAY (DNP / scratch / inactive) → that option is EXCLUDED from
 *     contention. If fewer than 2 eligible options remain, VOID the leg (nothing left to compare).
 *  3. A TIE for the winning composite → VOID the leg (no arbitrary winner picked).
 */

export type OptionStatus = "played" | "dnp" | "postponed";

/** One resolved option in a cross-game leg (a player, or a derived option like a duo/bucket). */
export interface OptionResult {
  /** the option identifier the entry's pick.choice must match (player name, "A"/"B" duo, bucket…). */
  key: string;
  /** the game this option's player(s) belong to — drives one-player-per-game + postponed voids. */
  gameId: string;
  /** the fantasy-points composite (0 for a DNP; ignored when the leg voids). */
  composite: number;
  status: OptionStatus;
}

export type EdgeReason = "postponed" | "dnp_insufficient" | "tie" | null;

export interface EligibilityResult {
  eligible: OptionResult[];
  voidLeg: boolean;
  reason: EdgeReason;
}

/** Policies 1 + 2: drop postponed/DNP; void if a postponed game exists or <2 eligible remain. */
export function applyEdgeEligibility(options: OptionResult[]): EligibilityResult {
  if (options.some((o) => o.status === "postponed")) {
    return { eligible: [], voidLeg: true, reason: "postponed" };
  }
  const eligible = options.filter((o) => o.status === "played");
  if (eligible.length < 2) {
    return { eligible, voidLeg: true, reason: "dnp_insufficient" };
  }
  return { eligible, voidLeg: false, reason: null };
}

/** Policy 3: the single highest composite, or a TIE → void. Operates on already-eligible options. */
export function highestOrTie(eligible: OptionResult[]): { winner: OptionResult | null; tie: boolean } {
  if (eligible.length === 0) return { winner: null, tie: false };
  const max = Math.max(...eligible.map((o) => o.composite));
  const top = eligible.filter((o) => o.composite === max);
  if (top.length !== 1) return { winner: null, tie: true };
  return { winner: top[0]!, tie: false };
}
