/**
 * CHAMPIONSHIP BOARD-STRIP — pure label helpers. The strip shows the player's division (by entry
 * tier), season win rate, and standing vs the qualification line. While QUALIFICATION_LINE is an
 * unset placeholder the line renders "—" — NEVER a placeholder number.
 */
import { CHAMPIONSHIP_DIVISIONS } from "@/lib/contest/architectSet";

/** Division label for a single entry tier, or null when unknown. */
export function divisionForTier(tier: number | null | undefined): string | null {
  if (tier == null) return null;
  return CHAMPIONSHIP_DIVISIONS.find((d) => d.tier === tier)?.label ?? null;
}

/**
 * The player's division from the paid tiers they've entered — the HIGHEST tier played (their top
 * division). "—" when they have no paid entries (no division yet).
 */
export function divisionLabelForTiers(tiers: number[]): string {
  const known = tiers.filter((t) => CHAMPIONSHIP_DIVISIONS.some((d) => d.tier === t));
  if (known.length === 0) return "—";
  const top = Math.max(...known);
  return divisionForTier(top) ?? "—";
}

/** Win-rate label; "—" when the player has no settled plays. */
export function winRateLabel(winRatePct: number | null): string {
  return winRatePct == null ? "—" : `${Math.round(winRatePct)}%`;
}

/** The qualification-line label — "—" until the architect sets QUALIFICATION_LINE. */
export function qualificationLineLabel(line: number | null): string {
  return line == null ? "—" : `${Math.round(line)}%`;
}

/**
 * Standing vs the line. Null line ⇒ "—" (no invented number). Otherwise a plain above/below read
 * off the player's win rate — no numbers beyond the (set) line and the player's own rate.
 */
export function standingLabel(winRatePct: number | null, line: number | null): string {
  if (line == null) return "—";
  if (winRatePct == null) return "Play a paid contest to get on the line";
  return winRatePct >= line ? "Above the line" : "Below the line";
}
