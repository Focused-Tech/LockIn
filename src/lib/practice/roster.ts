/**
 * PRACTICE ROSTER FIXTURES (client-safe, pure, no I/O).
 *
 * The archetype library builds legs from a normalized `Pool` (a standout player
 * per stat per game). The FEED builds that Pool from the live ESPN scoreboard —
 * but that source is `server-only` and needs a real, in-progress slate of games,
 * neither of which the practice ARENA can use: practice is client-fallback-first
 * and instant-settle (outcomes are pre-rolled and revealed on submit — there is no
 * real box score to grade). So practice draws from THESE curated rosters instead —
 * the same Pool SHAPE the feed produces (`poolFromGames`), just fixture-backed.
 *
 * The six approved archetypes are athlete-stat contests, so rosters exist for the
 * team sports the library supports (NBA/NFL/MLB/NHL/Soccer). A category without its
 * own roster falls back to NBA (see `rosterPool`).
 */
import type { Pool, PoolGame, PoolPlayer } from "@/lib/contest/archetypeLibrary";

interface StatDef {
  stat: string;
  boxLabel: string;
  leaderCat: string;
}
/** One game's standout per stat: [name, team, seasonVal, lastOut] per stat, in `stats` order. */
type GameRow = { away: string; home: string; cells: [string, string, number, string][] };

interface LeagueFixture {
  league: string;
  stats: StatDef[];
  games: GameRow[];
}

/** Build a Pool from a league fixture (mirrors the feed's poolFromGames shape). */
function poolFrom(category: string, fx: LeagueFixture): Pool {
  const games: PoolGame[] = fx.games.map((g, gi) => {
    const byStat: Record<string, PoolPlayer> = {};
    fx.stats.forEach((st, si) => {
      const cell = g.cells[si];
      if (!cell) return;
      const [name, team, seasonVal, lastOut] = cell;
      byStat[st.stat] = {
        name,
        team,
        gameId: `${fx.league}-g${gi}`,
        seasonVal,
        lastOut,
        stat: st.stat,
        boxLabel: st.boxLabel,
        leaderCat: st.leaderCat,
      };
    });
    return {
      gameId: `${fx.league}-g${gi}`,
      startMs: gi,
      gameLine: `${g.away} at ${g.home}`,
      byStat,
    };
  });
  return { league: fx.league, category, stats: fx.stats.map((s) => s.stat), games };
}

const NBA: LeagueFixture = {
  league: "nba",
  stats: [
    { stat: "points", boxLabel: "PTS", leaderCat: "points" },
    { stat: "rebounds", boxLabel: "REB", leaderCat: "rebounds" },
    { stat: "assists", boxLabel: "AST", leaderCat: "assists" },
  ],
  games: [
    { away: "Lakers", home: "Celtics", cells: [
      ["Luka Dončić", "LAL", 32, "34 pts"], ["Anthony Davis", "LAL", 12, "13 reb"], ["Jayson Tatum", "BOS", 6, "8 ast"] ] },
    { away: "Nuggets", home: "Timberwolves", cells: [
      ["Nikola Jokić", "DEN", 29, "28 pts"], ["Rudy Gobert", "MIN", 13, "15 reb"], ["Nikola Jokić", "DEN", 10, "11 ast"] ] },
    { away: "Bucks", home: "Knicks", cells: [
      ["Giannis Antetokounmpo", "MIL", 31, "30 pts"], ["Giannis Antetokounmpo", "MIL", 12, "14 reb"], ["Jalen Brunson", "NYK", 7, "9 ast"] ] },
    { away: "Thunder", home: "Mavericks", cells: [
      ["Shai Gilgeous-Alexander", "OKC", 30, "33 pts"], ["Dereck Lively II", "DAL", 9, "11 reb"], ["Shai Gilgeous-Alexander", "OKC", 6, "7 ast"] ] },
    { away: "Warriors", home: "Suns", cells: [
      ["Stephen Curry", "GSW", 27, "29 pts"], ["Kevin Durant", "PHX", 7, "9 reb"], ["Draymond Green", "GSW", 6, "8 ast"] ] },
    { away: "76ers", home: "Heat", cells: [
      ["Tyrese Maxey", "PHI", 26, "27 pts"], ["Joel Embiid", "PHI", 11, "12 reb"], ["Tyler Herro", "MIA", 5, "6 ast"] ] },
  ],
};

const NFL: LeagueFixture = {
  league: "nfl",
  stats: [
    { stat: "passing yards", boxLabel: "YDS", leaderCat: "passingYards" },
    { stat: "rushing yards", boxLabel: "YDS", leaderCat: "rushingYards" },
  ],
  games: [
    { away: "Chiefs", home: "Bills", cells: [
      ["Patrick Mahomes", "KC", 281, "295 yds"], ["James Cook", "BUF", 78, "84 yds"] ] },
    { away: "Ravens", home: "Bengals", cells: [
      ["Joe Burrow", "CIN", 274, "268 yds"], ["Derrick Henry", "BAL", 92, "99 yds"] ] },
    { away: "49ers", home: "Cowboys", cells: [
      ["Dak Prescott", "DAL", 259, "251 yds"], ["Christian McCaffrey", "SF", 88, "95 yds"] ] },
    { away: "Eagles", home: "Lions", cells: [
      ["Jared Goff", "DET", 266, "277 yds"], ["Saquon Barkley", "PHI", 96, "104 yds"] ] },
  ],
};

const MLB: LeagueFixture = {
  league: "mlb",
  stats: [
    { stat: "hits", boxLabel: "H", leaderCat: "RBIs" },
    { stat: "home runs", boxLabel: "HR", leaderCat: "homeRuns" },
  ],
  games: [
    { away: "Dodgers", home: "Padres", cells: [
      ["Mookie Betts", "LAD", 2, "2 H"], ["Manny Machado", "SD", 1, "1 HR"] ] },
    { away: "Yankees", home: "Red Sox", cells: [
      ["Aaron Judge", "NYY", 2, "3 H"], ["Aaron Judge", "NYY", 1, "1 HR"] ] },
    { away: "Braves", home: "Phillies", cells: [
      ["Ronald Acuña Jr.", "ATL", 2, "2 H"], ["Bryce Harper", "PHI", 1, "1 HR"] ] },
    { away: "Astros", home: "Rangers", cells: [
      ["Yordan Alvarez", "HOU", 2, "2 H"], ["Corey Seager", "TEX", 1, "1 HR"] ] },
  ],
};

const NHL: LeagueFixture = {
  league: "nhl",
  stats: [
    { stat: "points", boxLabel: "P", leaderCat: "points" },
    { stat: "goals", boxLabel: "G", leaderCat: "goals" },
  ],
  games: [
    { away: "Oilers", home: "Avalanche", cells: [
      ["Connor McDavid", "EDM", 2, "2 pts"], ["Nathan MacKinnon", "COL", 1, "1 G"] ] },
    { away: "Panthers", home: "Bruins", cells: [
      ["Matthew Tkachuk", "FLA", 2, "1 pt"], ["David Pastrňák", "BOS", 1, "2 G"] ] },
    { away: "Rangers", home: "Hurricanes", cells: [
      ["Artemi Panarin", "NYR", 2, "3 pts"], ["Sebastian Aho", "CAR", 1, "1 G"] ] },
  ],
};

const SOCCER: LeagueFixture = {
  league: "eng.1",
  stats: [{ stat: "goals", boxLabel: "G", leaderCat: "goals" }],
  games: [
    { away: "Arsenal", home: "Man City", cells: [["Erling Haaland", "MCI", 1, "2 G"]] },
    { away: "Liverpool", home: "Chelsea", cells: [["Mohamed Salah", "LIV", 1, "1 G"]] },
    { away: "Spurs", home: "Man United", cells: [["Son Heung-min", "TOT", 1, "1 G"]] },
    { away: "Newcastle", home: "Aston Villa", cells: [["Alexander Isak", "NEW", 1, "1 G"]] },
  ],
};

/** Category → league fixture. Sports the archetype library supports; else NBA. */
const CATEGORY_FIXTURE: Record<string, LeagueFixture> = {
  NBA: NBA,
  NFL: NFL,
  MLB: MLB,
  NHL: NHL,
  Soccer: SOCCER,
};

/**
 * A normalized archetype-library Pool for a practice category. Sports map to their
 * roster; every other category falls back to the NBA roster (the six archetypes are
 * athlete-stat contests — non-sports practice is a separate ruling).
 */
export function rosterPool(category: string): Pool {
  const fx = CATEGORY_FIXTURE[category] ?? NBA;
  return poolFrom(category, fx);
}
