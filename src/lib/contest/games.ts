/**
 * CREATOR-MODE GAME TYPES (§1 · "Tonight's games").
 *
 * The seed is GONE (§1.C). Live games + rosters come from the ESPN feed via
 * src/server/feeds/creatorGames.ts (getTodaysCreatorGames) → the stats provider. The builder is
 * feed-agnostic: it takes a CreatorGame[]. Fixtures exist ONLY as a test double for the gates.
 */
import type { EnginePlayer } from "./questionEngine";
import type { ScoringSport } from "./architectSet";

export interface CreatorGamePlayer {
  name: string;
  team: string;
  /** ESPN athlete id — carried so settlement can pull the player's box score. */
  playerId?: string;
}
export interface CreatorGame {
  id: string;
  away: string;
  home: string;
  tipoff: string;
  /** UTC epoch millis of the first tip — drives slate close (§1.E: close BEFORE the first event). */
  startMs: number;
  sport: ScoringSport;
  players: CreatorGamePlayer[];
}

/** The question templates the "+ Add a question" button cycles through. */
export const QUESTION_TEMPLATES = [
  "Who has the bigger night?",
  "Who takes over in the fourth?",
  "Who's due for a bounce-back?",
  "Who does the most damage?",
];

/** Flatten the selected games' rosters into EnginePlayers (name keyed to gameId) for validateLeg. */
export function enginePlayersFor(games: CreatorGame[], selectedIds: string[]): EnginePlayer[] {
  const out: EnginePlayer[] = [];
  for (const g of games) {
    if (!selectedIds.includes(g.id)) continue;
    for (const p of g.players) out.push({ name: p.name, gameId: g.id, team: p.team });
  }
  return out;
}

/** The earliest tip among the selected games → slate close must be before it (§1.E). */
export function earliestStartMs(games: CreatorGame[], selectedIds: string[]): number | null {
  const times = games.filter((g) => selectedIds.includes(g.id)).map((g) => g.startMs).filter((t) => t > 0);
  return times.length ? Math.min(...times) : null;
}
