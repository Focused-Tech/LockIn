/**
 * CROSS-GAME SLATE SETTLEMENT (§2.3 + §2.5) — pure. Resolves every archetype leg against the fantasy
 * composite, scores each entry (correct legs; perfect = all non-void legs correct), then applies the
 * §2.5 bands (HERO/PREMIUM/STANDARD). Voided legs (§2.4) count for nobody. Stats are supplied by the
 * caller (fixtures in the gate; the live feed carries none yet — §1.2). Money stays on placeholders
 * (§2.6): this produces bands + payouts against a supplied net pool; it does NOT reroute live cash.
 */
import { resolveArchetype, type ArchetypeResolution, type CrossGameLeg, type PlayerResult } from "./archetypes";
import { bandField, type BandInput, type BandedEntry } from "./bands";

export interface ProLegSpec {
  predictionId: string;
  leg: CrossGameLeg;
}
export interface ProEntryInput {
  id: string;
  entryCostCents: number;
  submittedAtMs: number;
  /** predictionId → chosen option key. */
  picks: Record<string, string>;
}
export interface ProSettlement {
  results: Record<string, ArchetypeResolution>;
  banded: BandedEntry[];
  /** legs that voided (§2.4) — excluded from every entry's score. */
  voided: string[];
}

export function settleProSlate(
  legs: ProLegSpec[],
  entries: ProEntryInput[],
  byPlayer: Record<string, PlayerResult>,
  netPoolCents: number,
): ProSettlement {
  const results: Record<string, ArchetypeResolution> = {};
  for (const l of legs) results[l.predictionId] = resolveArchetype(l.leg, byPlayer);

  const live = legs.filter((l) => !results[l.predictionId]!.voidLeg);
  const voided = legs.filter((l) => results[l.predictionId]!.voidLeg).map((l) => l.predictionId);

  const bandInputs: BandInput[] = entries.map((e) => {
    let correct = 0;
    for (const l of live) {
      if (e.picks[l.predictionId] === results[l.predictionId]!.winningKey) correct++;
    }
    return {
      id: e.id,
      entryCostCents: e.entryCostCents,
      // §2 void semantics: ONE consistent rule used for both scoring (here) and hero ranking (bands
      // reads THIS perfect + score). A void voids the LEG — the card scores on its live legs (the
      // stake stays in). §2.2: a void must NOT make a card perfect, so ANY voided leg disqualifies
      // "perfect" for the whole slate (no hero seats gamed by a void).
      perfect: voided.length === 0 && live.length > 0 && correct === live.length,
      score: correct,
      submittedAtMs: e.submittedAtMs,
    };
  });

  return { results, banded: bandField(bandInputs, netPoolCents), voided };
}
