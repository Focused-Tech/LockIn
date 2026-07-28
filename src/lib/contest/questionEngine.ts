/**
 * SLICE 2 — QUESTION ENGINE (pure logic, NO UI).
 *
 * 2.1 THE RULE THAT DECIDES EVERYTHING: every player in a LEG comes from a DIFFERENT game — one
 * player per game, maximum. Two-way needs two games; four-way needs four. Validated PER LEG (a
 * card of one-game legs does not launder them), rejected at publish.
 */
import type { FormatTier } from "@/lib/eligibility";

export interface EnginePlayer {
  name: string;
  /** the game this player is in — the identity the one-per-game rule keys on. */
  gameId: string;
  team: string;
}

/** SLICE 2.3 — the ONLY approved archetypes. A leg must be one of these; nothing else publishes. */
export const APPROVED_ARCHETYPES = [
  "cross_game_h2h", // cross-game head-to-head
  "field_leader", // field leader across named players
  "split_squad_duos", // split-squad duos that each straddle two games
  "milestone_count", // milestone COUNT bucketed by how many players cleared it
  "first_to_n", // first-to-N across games
  "biggest_night", // biggest night / player of the night on a composite line
] as const;
export type Archetype = (typeof APPROVED_ARCHETYPES)[number];

/**
 * SLICE 2.2 — BANNED archetypes (hard walls for creators AND the AI generator). These never become
 * templates; the detector below is the generator/report guard. Milestone framing does not rescue a
 * single-game question — a running total is a constant on both sides of the inequality.
 */
export const BANNED_ARCHETYPES = [
  "team_or_game_outcome", // who-wins, scores, margins, halftime
  "combined_team_totals", // single teams AND combinations of teams
  "single_athlete_single_game", // any question resolving on one athlete in one game
  "individual_numeric_threshold", // ANY number attached to an individual = an over/under
  "fight_or_race_winner",
] as const;
export type BannedArchetype = (typeof BANNED_ARCHETYPES)[number];

/** SLICE 2.5 — CONTEXT is REQUIRED on every leg and is DISPLAY ONLY, never a threshold. */
export interface LegContext {
  seasonAverage: string;
  last3Form: string;
  matchupNote: string;
}

export interface Leg {
  archetype: Archetype;
  /** the players this leg resolves across. */
  players: EnginePlayer[];
  context: LegContext | null;
  /** DISPLAY-ONLY poll signal (0–100). A leg where one option polls >80% is a dead slot (2.6). */
  favoritePollPct?: number;
}

export interface LegVerdict {
  ok: boolean;
  /** player-facing / creator-facing message that NAMES THE FIX (Lockpick, slice 3.3). */
  message: string;
  /** machine reason for the reject path. */
  reason?:
    | "too_few_players"
    | "two_from_one_game" // the one-player-per-game violation
    | "missing_context"
    | "dead_slot"
    | "banned_archetype";
}

/**
 * SLICE 2.1 — validate ONE leg. Enforces one-player-per-game and NAMES THE FIX. `allowedGameIds`
 * are the games the creator selected (so the "swap to X" suggestion only offers eligible games).
 */
export function validateLeg(leg: Leg, allowedGameIds: string[]): LegVerdict {
  if (!APPROVED_ARCHETYPES.includes(leg.archetype)) {
    return { ok: false, reason: "banned_archetype", message: "That question type isn't allowed — pick an approved cross-game archetype." };
  }
  if (leg.players.length < 2) {
    return { ok: false, reason: "too_few_players", message: "Pick at least two players from two different games." };
  }
  // one-player-per-game: first collision is the reject, and we name the two players + the shared game.
  const seen = new Map<string, string>(); // gameId -> first player name seen
  for (const p of leg.players) {
    const prior = seen.get(p.gameId);
    if (prior) {
      const alt = suggestSwap(leg, allowedGameIds, seen);
      const fix = alt ? `drop one, or swap to ${alt}.` : "drop one, or add another game.";
      return {
        ok: false,
        reason: "two_from_one_game",
        message: `${prior} and ${p.name} are both in the same game (${p.team}'s game) — one player per game. ${fix}`,
      };
    }
    seen.set(p.gameId, p.name);
  }
  // 2.5 context is mandatory (display-only, but must be present to publish).
  if (!leg.context) {
    return { ok: false, reason: "missing_context", message: "Add the display context (season avg, last-3 form, a matchup note) before publishing." };
  }
  // 2.6 kill dead slots — a lopsided leg is not a real call.
  if (typeof leg.favoritePollPct === "number" && leg.favoritePollPct > 80) {
    return { ok: false, reason: "dead_slot", message: `This leg is a dead slot (${leg.favoritePollPct}% pick one side) — swap in a closer call between comparable stars.` };
  }
  const n = seen.size;
  return { ok: true, message: `${n} players, ${n} different games. Clean.` };
}

/** Suggest a swap from an as-yet-unused selected game (mirrors the mockup's Lockpick hint). */
function suggestSwap(leg: Leg, allowedGameIds: string[], used: Map<string, string>): string | null {
  const usedGames = new Set(used.keys());
  // Prefer a game the creator selected that this leg isn't already using.
  const freeGame = allowedGameIds.find((g) => !usedGames.has(g));
  if (!freeGame) return null;
  // We only know the players inside this leg; the caller (Lockpick UI) can substitute a real roster
  // name. Here we simply signal that an unused game exists.
  return `a player from another of your games`;
}

/**
 * SLICE 3.5 — a slate publishes only when EVERY leg passes. Returns the per-leg verdicts + the
 * publish gate. Validated per leg, never per card.
 */
export function validateSlate(legs: Leg[], allowedGameIds: string[]): {
  legVerdicts: LegVerdict[];
  canPublish: boolean;
} {
  const legVerdicts = legs.map((l) => validateLeg(l, allowedGameIds));
  return {
    legVerdicts,
    canPublish: legs.length > 0 && legVerdicts.every((v) => v.ok),
  };
}

/**
 * SLICE 2.4 — which question pool a user sees, decided by the format tier from the slice-1 resolver.
 * STANDARD sees all approved archetypes; RESTRICTED (CA/FL) sees the tighter set.
 */
const RESTRICTED_POOL: Archetype[] = ["cross_game_h2h", "field_leader", "milestone_count"];
export function archetypePool(tier: FormatTier): Archetype[] {
  return tier === "restricted" ? RESTRICTED_POOL : [...APPROVED_ARCHETYPES];
}

/** SLICE 2.6 — a leg is a dead slot when one option polls above 80%. Display-only signal. */
export function isDeadSlot(favoritePollPct: number): boolean {
  return favoritePollPct > 80;
}
