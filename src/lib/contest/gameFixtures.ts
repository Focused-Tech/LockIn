/**
 * TEST FIXTURES — the double for the gates ONLY (§1.B). Never imported by runtime code; the live
 * path is ESPN via src/server/feeds/statsProvider.ts. Two games, real one-player-per-game structure.
 */
import type { CreatorGame } from "./games";

export const FIXTURE_GAMES: CreatorGame[] = [
  {
    id: "gA", away: "Lakers", home: "Celtics", tipoff: "7:10p", startMs: 4_000_000_000_000, sport: "basketball",
    players: [
      { name: "Luka", team: "LAL", playerId: "p_luka" }, { name: "LeBron", team: "LAL", playerId: "p_lebron" },
      { name: "Tatum", team: "BOS", playerId: "p_tatum" }, { name: "Brown", team: "BOS", playerId: "p_brown" },
    ],
  },
  {
    id: "gB", away: "76ers", home: "Warriors", tipoff: "10:00p", startMs: 4_000_000_500_000, sport: "basketball",
    players: [
      { name: "Embiid", team: "PHI", playerId: "p_embiid" }, { name: "Maxey", team: "PHI", playerId: "p_maxey" },
      { name: "Curry", team: "GSW", playerId: "p_curry" }, { name: "Green", team: "GSW", playerId: "p_green" },
    ],
  },
];
