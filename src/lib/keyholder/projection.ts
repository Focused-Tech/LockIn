/**
 * KEYHOLDER PROJECTION — pure math over the architectSet placeholders.
 *
 * EVERY rate/cap/threshold comes from architectSet.ts. While any required input is an unset
 * placeholder (null / []), the system is "unarmed": participation% still computes (it needs only
 * entries + verified followers), but every DOLLAR figure is null and the portal must render "—" and
 * the "PROJECTED — rates pending final approval" label. No number is ever inlined here.
 */

import {
  KEYHOLDER_TRIGGER_BANDS,
  KEYHOLDER_ANNUAL_CAP_CENTS,
  FIELD_PCT_PAID,
  PLAYER_QUALIFY_ENTRIES_CENTS,
  PLAYER_REFERRAL_BOUNTY_CENTS,
} from "@/lib/contest/architectSet";

/**
 * participation_pct = entries / verified follower count.
 * Returns null when there is no social connect (no verified follower count) — the caller renders
 * "—", NEVER 0. Also null for a non-positive follower count (guards divide-by-zero).
 */
export function participationPct(entries: number, verifiedFollowers: number | null | undefined): number | null {
  if (verifiedFollowers == null || verifiedFollowers <= 0) return null;
  return entries / verifiedFollowers;
}

export interface TriggerBand {
  minParticipationPct: number;
  rate: number;
}

/**
 * The trigger band a participation% falls into (highest band whose floor it meets), or null when the
 * bands are unset or the pct is null / below the lowest floor.
 */
export function triggerBand(pct: number | null): TriggerBand | null {
  if (pct == null || KEYHOLDER_TRIGGER_BANDS.length === 0) return null;
  const sorted = [...KEYHOLDER_TRIGGER_BANDS].sort((a, b) => b.minParticipationPct - a.minParticipationPct);
  return sorted.find((b) => pct >= b.minParticipationPct) ?? null;
}

/** A human label for the band status shown on the "My creators" rows. */
export function triggerBandStatus(pct: number | null): string {
  if (pct == null) return "—";
  if (KEYHOLDER_TRIGGER_BANDS.length === 0) return "Pending rates";
  const band = triggerBand(pct);
  return band ? `Band ≥ ${(band.minParticipationPct * 100).toFixed(0)}%` : "Below first band";
}

/** True once the keyholder earnings model has every input it needs to project a dollar figure. */
export function keyholderRatesArmed(): boolean {
  return (
    KEYHOLDER_TRIGGER_BANDS.length > 0 &&
    KEYHOLDER_ANNUAL_CAP_CENTS != null &&
    FIELD_PCT_PAID != null
  );
}

/** True once the player-bounty model is fully specified. */
export function playerBountyArmed(): boolean {
  return PLAYER_QUALIFY_ENTRIES_CENTS != null && PLAYER_REFERRAL_BOUNTY_CENTS != null;
}

export interface ProjectedEarnings {
  /** false ⇒ render "—" for every dollar amount, with the pending-rates label. */
  armed: boolean;
  creatorProjectedCents: number | null;
  playerProjectedCents: number | null;
  totalProjectedCents: number | null;
}

export interface ProjectionInputs {
  /** Per referred-creator event: entries and the participation% at settlement. */
  creatorEvents: { entries: number; participationPct: number | null }[];
  /** Count of referred players who have qualified. */
  qualifiedPlayers: number;
}

/**
 * Projected (NOT paid) keyholder earnings from the placeholders. Returns all-null dollar amounts
 * whenever unarmed. When armed, creator projection sums band.rate × (entries × FIELD_PCT_PAID) per
 * event, capped at the annual cap; player projection is bounty × qualified players. This is a
 * projection surface only — no money moves anywhere from it, and there is no payout path.
 */
export function projectKeyholderEarnings(inputs: ProjectionInputs): ProjectedEarnings {
  const creatorArmed = keyholderRatesArmed();
  const bountyArmed = playerBountyArmed();
  if (!creatorArmed && !bountyArmed) {
    return { armed: false, creatorProjectedCents: null, playerProjectedCents: null, totalProjectedCents: null };
  }

  let creatorCents: number | null = null;
  if (creatorArmed) {
    const fieldPct = FIELD_PCT_PAID as number;
    const raw = inputs.creatorEvents.reduce((sum, e) => {
      const band = triggerBand(e.participationPct);
      if (!band) return sum;
      return sum + band.rate * (e.entries * fieldPct);
    }, 0);
    creatorCents = Math.min(Math.round(raw), KEYHOLDER_ANNUAL_CAP_CENTS as number);
  }

  let playerCents: number | null = null;
  if (bountyArmed) {
    playerCents = inputs.qualifiedPlayers * (PLAYER_REFERRAL_BOUNTY_CENTS as number);
  }

  const total = (creatorCents ?? 0) + (playerCents ?? 0);
  return {
    armed: creatorArmed || bountyArmed,
    creatorProjectedCents: creatorCents,
    playerProjectedCents: playerCents,
    totalProjectedCents: creatorArmed || bountyArmed ? total : null,
  };
}
