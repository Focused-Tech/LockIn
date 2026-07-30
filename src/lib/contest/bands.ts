/**
 * CROSS-GAME PAYOUT BANDS (§2.5) — the LOCKED bands for pro/cross-game slates. Distinct from the
 * feed/regular rank-share curve (constants.ts PAYOUT_BANDS), which is untouched (RULE 3).
 *
 *   HERO     — the top 5 PERFECT cards, ranked by LOCK-IN SPEED (earliest lock wins). Share 25% of
 *              the net pool, each capped at 1000× entry (overflow → house).
 *   PREMIUM  — the next 45 by rank, at 10× entry.
 *   STANDARD — out to ~top 20% of the field, at a 1.5× floor.
 *
 * The lock-in timestamp hero-ranking needs is the entry's `submittedAt` (persisted at
 * src/app/app/slate/[id]/actions.ts:126; carried into settlement as submittedAtMs).
 *
 * NOTE (§2.6): live CASH settlement stays on the existing path. This is the pro-slate machinery,
 * built complete + correct; it does not reroute the tier-based cash path.
 */
import { PAYOUT_CAP_MULTIPLIER } from "@/lib/constants";

export const HERO_MAX = 5;
export const HERO_NET_SHARE = 0.25;
export const HERO_CAP_MULT = PAYOUT_CAP_MULTIPLIER; // 1000× entry
export const PREMIUM_MAX = 45;
export const PREMIUM_MULT = 10;
export const STANDARD_MULT = 1.5;
export const STANDARD_FIELD_PCT = 0.2; // paid out to ~top 20% of the field

export type Band = "hero" | "premium" | "standard" | "none";

export interface BandInput {
  id: string;
  entryCostCents: number;
  perfect: boolean;
  score: number;
  submittedAtMs: number;
}

export interface BandedEntry {
  id: string;
  band: Band;
  rank: number;
  payoutCents: number;
}

/** rank order: score desc → earlier lock-in → id (matches the existing settlement tiebreak). */
function byRank(a: BandInput, b: BandInput): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.submittedAtMs !== b.submittedAtMs) return a.submittedAtMs - b.submittedAtMs;
  return a.id < b.id ? -1 : 1;
}

/**
 * Assign bands + payouts across a field for a pro slate at a given net pool (cents).
 * Every entry gets a band (`none` = out of the money) and a payout.
 */
export function bandField(entries: BandInput[], netPoolCents: number): BandedEntry[] {
  const field = entries.length;
  const ranked = [...entries].sort(byRank);
  const rankOf = new Map(ranked.map((e, i) => [e.id, i + 1]));

  // HERO — perfect cards, the 5 FASTEST locks (earliest submittedAt).
  const heroes = entries
    .filter((e) => e.perfect)
    .sort((a, b) => (a.submittedAtMs !== b.submittedAtMs ? a.submittedAtMs - b.submittedAtMs : a.id < b.id ? -1 : 1))
    .slice(0, HERO_MAX);
  const heroIds = new Set(heroes.map((h) => h.id));
  const heroPer = heroes.length ? Math.floor((netPoolCents * HERO_NET_SHARE) / heroes.length) : 0;

  // PREMIUM then STANDARD, by rank, over the non-heroes, out to the top 20% of the field.
  const paidCount = Math.ceil(field * STANDARD_FIELD_PCT);
  const nonHeroesRanked = ranked.filter((e) => !heroIds.has(e.id));

  const out: BandedEntry[] = [];
  const push = (e: BandInput, band: Band, payoutCents: number) =>
    out.push({ id: e.id, band, rank: rankOf.get(e.id)!, payoutCents });

  for (const h of heroes) {
    push(h, "hero", Math.min(HERO_CAP_MULT * h.entryCostCents, heroPer));
  }

  let paid = heroes.length; // heroes count toward the top-20% paid field
  let premiumGiven = 0;
  for (const e of nonHeroesRanked) {
    if (paid >= paidCount) { push(e, "none", 0); continue; }
    if (premiumGiven < PREMIUM_MAX) {
      push(e, "premium", PREMIUM_MULT * e.entryCostCents);
      premiumGiven++;
    } else {
      push(e, "standard", Math.round(STANDARD_MULT * e.entryCostCents));
    }
    paid++;
  }
  return out;
}
