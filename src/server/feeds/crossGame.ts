import "server-only";

/**
 * CROSS-GAME HEAD-TO-HEAD feed — the compliant transform of ESPN's real game data into the approved
 * archetype. Instead of serving ESPN's betting markets (moneyline / spread / total — all banned), we
 * take each game's standout player (from ESPN's stat `leaders`) and pair players ACROSS DIFFERENT
 * games into head-to-head legs: "More {stat} tonight? PlayerA · TeamA  vs  PlayerB · TeamB" — one
 * player per game, per leg. Settlement grades each leg from the players' real box-score stats.
 */

/** Per-league config: `leaderCat` picks the standout player; `boxLabel` is the box-score column that
 *  grades tonight's performance; `statLabel` is the human word used in the question + context. */
export const H2H_CONFIG: Record<string, { sport: string; leaderCat: string; boxLabel: string; statLabel: string }> = {
  mlb: { sport: "baseball", leaderCat: "RBIs", boxLabel: "H", statLabel: "hits" },
  wnba: { sport: "basketball", leaderCat: "points", boxLabel: "PTS", statLabel: "points" },
  nba: { sport: "basketball", leaderCat: "points", boxLabel: "PTS", statLabel: "points" },
  nfl: { sport: "football", leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" },
  "college-football": { sport: "football", leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" },
  nhl: { sport: "hockey", leaderCat: "points", boxLabel: "P", statLabel: "points" },
  "usa.1": { sport: "soccer", leaderCat: "goals", boxLabel: "G", statLabel: "goals" },
  "eng.1": { sport: "soccer", leaderCat: "goals", boxLabel: "G", statLabel: "goals" },
};

export interface H2HPlayer { playerId: string; name: string; team: string; eventId: string; seasonVal: number }
export interface H2HLegMeta { stat: string; boxLabel: string; a: H2HPlayer; b: H2HPlayer }

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FeedGame {
  eventId: string;
  startMs: number;
  homeName: string;
  awayName: string;
  /** raw ESPN competitors (each carries `.leaders`). */
  competitors: any[];
}

/** A game's standout player in the league's primary category (max value across both teams). Returns
 *  null when that category isn't present — so the graded stat always matches the picked player. */
export function pickTopPlayer(game: FeedGame, leaderCat: string): H2HPlayer | null {
  let best: H2HPlayer | null = null;
  for (const comp of game.competitors || []) {
    const team = comp?.team?.displayName ?? comp?.team?.name ?? "";
    const cat = (comp?.leaders || []).find((L: any) => L?.name === leaderCat);
    const top = cat?.leaders?.[0];
    const ath = top?.athlete;
    if (!ath?.id || !ath?.displayName) continue;
    const val = Number(top?.value ?? 0);
    if (!best || val > best.seasonVal) best = { playerId: String(ath.id), name: ath.displayName, team, eventId: game.eventId, seasonVal: Number.isFinite(val) ? val : 0 };
  }
  return best;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CrossGameLeg {
  question: string;
  optionA: string;
  optionB: string;
  probA: number;
  probB: number;
  h2h: H2HLegMeta;
}
export interface CrossGameSlate {
  slateId: string;
  title: string;
  category: string;
  lockMs: number;
  legs: CrossGameLeg[];
}

/** A mild lean from season form, clamped to 40–60 so no leg is a dead slot (>80% one side). */
function lean(aVal: number, bVal: number): number {
  const t = aVal + bVal;
  if (t <= 0) return 50;
  return Math.min(60, Math.max(40, Math.round((100 * aVal) / t)));
}

/**
 * Build ONE cross-game head-to-head slate for a league. Pairs consecutive games' standout players
 * (sorted by start) into legs — every leg's two players come from DIFFERENT games. null if fewer than
 * two usable games. Context (each player's season stat) is carried inline in the option label.
 */
export function buildCrossGameSlate(input: { league: string; category: string; games: FeedGame[] }): CrossGameSlate | null {
  const cfg = H2H_CONFIG[input.league];
  if (!cfg) return null;
  const tops = input.games
    .map((g) => ({ g, p: pickTopPlayer(g, cfg.leaderCat) }))
    .filter((x): x is { g: FeedGame; p: H2HPlayer } => x.p !== null)
    .sort((x, y) => x.g.startMs - y.g.startMs);
  if (tops.length < 2) return null;

  const legs: CrossGameLeg[] = [];
  for (let i = 0; i + 1 < tops.length; i += 2) {
    const A = tops[i]!.p, B = tops[i + 1]!.p;
    if (A.eventId === B.eventId) continue; // never two players from the same game
    const probA = lean(A.seasonVal, B.seasonVal);
    legs.push({
      question: `More ${cfg.statLabel} tonight?`,
      optionA: `${A.name} · ${A.team} · ${A.seasonVal} ${cfg.statLabel} (season)`,
      optionB: `${B.name} · ${B.team} · ${B.seasonVal} ${cfg.statLabel} (season)`,
      probA,
      probB: 100 - probA,
      h2h: { stat: cfg.statLabel, boxLabel: cfg.boxLabel, a: A, b: B },
    });
  }
  if (!legs.length) return null;
  return {
    slateId: `h2h-${input.league}`,
    title: `${input.category} tonight — head to head`,
    category: input.category,
    lockMs: Math.min(...tops.map((t) => t.g.startMs)),
    legs,
  };
}

/** A cross-game head-to-head slate id (`h2h-{league}`). */
export function isH2HSlateId(id: string): boolean {
  return /^h2h-/.test(id);
}

/**
 * Fetch an athlete's box-score stat for one game. Returns `{ completed, val }` — `completed` is whether
 * the game is FINAL; `val` is the numeric stat (null if the player has no line yet / didn't play). null
 * return = the summary couldn't be fetched at all.
 */
/** PURE — pull an athlete's numeric stat out of an ESPN summary's box score, or null if not present.
 *  Finds the stat group that contains BOTH the athlete AND the box label (NFL has passing/rushing
 *  groups; the QB sits in the passing group whose labels include "YDS"). */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function extractAthleteStat(summary: any, athleteId: string, boxLabel: string): number | null {
  for (const teamBlock of summary?.boxscore?.players ?? []) {
    for (const grp of teamBlock?.statistics ?? []) {
      const labels: string[] = grp?.labels ?? grp?.names ?? [];
      const idx = labels.indexOf(boxLabel);
      if (idx < 0) continue;
      const ath = (grp?.athletes ?? []).find((a: any) => String(a?.athlete?.id) === String(athleteId));
      if (ath) {
        const val = Number(String(ath.stats?.[idx] ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(val) ? val : null;
      }
    }
  }
  return null;
}

/** True once the game is final. */
export function summaryCompleted(summary: any): boolean {
  const st = summary?.header?.competitions?.[0]?.status?.type;
  return st?.completed === true || st?.state === "post";
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchAthleteStat(
  sport: string,
  league: string,
  eventId: string,
  athleteId: string,
  boxLabel: string,
): Promise<{ completed: boolean; val: number | null } | null> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${eventId}`, { cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return { completed: summaryCompleted(d), val: extractAthleteStat(d, athleteId, boxLabel) };
  } catch (err) {
    console.error("[feed] fetchAthleteStat failed", eventId, athleteId, err);
    return null;
  }
}

/** Higher stat wins → "a"/"b". Equal or missing → null (the caller routes to manual review). */
export function resolveH2H(aVal: number | null, bVal: number | null): "a" | "b" | null {
  if (aVal == null || bVal == null || Number.isNaN(aVal) || Number.isNaN(bVal)) return null;
  if (aVal === bVal) return null;
  return aVal > bVal ? "a" : "b";
}
