/**
 * CREATOR-MODE GAME FEED (slice 4 · "Tonight's games").
 *
 * The pool of games a creator picks from; each selected game's roster fills the player pool the
 * question legs draw from. Shape mirrors design/lockin_creator_mode_mockup.html.
 *
 * SEED for now — a representative slate of tonight's games. Wire to the live feed (ESPN / Odds API,
 * see scripts/sync-feed) by having the page fetch real games and pass them into the builder; the
 * builder is already feed-agnostic (it takes a CreatorGame[]).
 */
import type { EnginePlayer } from "./questionEngine";

export interface CreatorGamePlayer {
  name: string;
  team: string;
}
export interface CreatorGame {
  id: string;
  away: string;
  home: string;
  tipoff: string;
  players: CreatorGamePlayer[];
}

export const TONIGHTS_GAMES: CreatorGame[] = [
  {
    id: "g1", away: "Lakers", home: "Celtics", tipoff: "7:10p",
    players: [
      { name: "Luka Dončić", team: "Lakers" }, { name: "LeBron James", team: "Lakers" },
      { name: "Jayson Tatum", team: "Celtics" }, { name: "Jaylen Brown", team: "Celtics" },
    ],
  },
  {
    id: "g2", away: "76ers", home: "Warriors", tipoff: "10:00p",
    players: [
      { name: "Joel Embiid", team: "76ers" }, { name: "Tyrese Maxey", team: "76ers" },
      { name: "Stephen Curry", team: "Warriors" }, { name: "Draymond Green", team: "Warriors" },
    ],
  },
  {
    id: "g3", away: "Bucks", home: "Heat", tipoff: "7:30p",
    players: [
      { name: "Giannis Antetokounmpo", team: "Bucks" }, { name: "Damian Lillard", team: "Bucks" },
      { name: "Bam Adebayo", team: "Heat" }, { name: "Tyler Herro", team: "Heat" },
    ],
  },
  {
    id: "g4", away: "Nuggets", home: "Suns", tipoff: "9:00p",
    players: [
      { name: "Nikola Jokić", team: "Nuggets" }, { name: "Jamal Murray", team: "Nuggets" },
      { name: "Kevin Durant", team: "Suns" }, { name: "Devin Booker", team: "Suns" },
    ],
  },
];

/** The question templates the "+ Add a question" button cycles through (mockup TEMPLATES). */
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
