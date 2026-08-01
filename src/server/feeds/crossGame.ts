import "server-only";

/**
 * CROSS-GAME HEAD-TO-HEAD feed — the compliant transform of ESPN's real game data into the approved
 * archetype. Instead of serving ESPN's betting markets (moneyline / spread / total — all banned), we
 * take each game's standout player (from ESPN's stat `leaders`) and pair players ACROSS DIFFERENT
 * games into head-to-head legs: "More {stat} tonight? PlayerA · TeamA  vs  PlayerB · TeamB" — one
 * player per game, per leg. Settlement grades each leg from the players' real box-score stats.
 */

/** One graded stat: `leaderCat` picks the standout player from ESPN `leaders`; `boxLabel` is the
 *  box-score column that grades tonight; `statLabel` is the human word in the question + context. */
export interface H2HStat { leaderCat: string; boxLabel: string; statLabel: string }

/** Per-league config: the sport (for the summary URL) + the STATS a slate can draw across, so one
 *  card mixes points/rebounds/assists etc. rather than repeating a single stat. */
export const H2H_CONFIG: Record<string, { sport: string; stats: H2HStat[] }> = {
  mlb: { sport: "baseball", stats: [
    { leaderCat: "RBIs", boxLabel: "H", statLabel: "hits" },
    { leaderCat: "homeRuns", boxLabel: "HR", statLabel: "home runs" },
  ] },
  wnba: { sport: "basketball", stats: [
    { leaderCat: "points", boxLabel: "PTS", statLabel: "points" },
    { leaderCat: "rebounds", boxLabel: "REB", statLabel: "rebounds" },
    { leaderCat: "assists", boxLabel: "AST", statLabel: "assists" },
  ] },
  nba: { sport: "basketball", stats: [
    { leaderCat: "points", boxLabel: "PTS", statLabel: "points" },
    { leaderCat: "rebounds", boxLabel: "REB", statLabel: "rebounds" },
    { leaderCat: "assists", boxLabel: "AST", statLabel: "assists" },
  ] },
  nfl: { sport: "football", stats: [
    { leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" },
    { leaderCat: "rushingYards", boxLabel: "YDS", statLabel: "rushing yards" },
  ] },
  "college-football": { sport: "football", stats: [
    { leaderCat: "passingYards", boxLabel: "YDS", statLabel: "passing yards" },
    { leaderCat: "rushingYards", boxLabel: "YDS", statLabel: "rushing yards" },
  ] },
  nhl: { sport: "hockey", stats: [
    { leaderCat: "points", boxLabel: "P", statLabel: "points" },
    { leaderCat: "goals", boxLabel: "G", statLabel: "goals" },
  ] },
  "usa.1": { sport: "soccer", stats: [{ leaderCat: "goals", boxLabel: "G", statLabel: "goals" }] },
  "eng.1": { sport: "soccer", stats: [{ leaderCat: "goals", boxLabel: "G", statLabel: "goals" }] },
};

/**
 * §3.3 — QUESTION STEMS (the argument real fans have — "who shows out," never "who wins"). Multiple
 * per archetype so the same archetype never reads identically twice on one card; `{stat}` is filled
 * with the leg's stat. Deliberately clear of banned framing (no wins/over/under/spread/total).
 */
export const H2H_STEMS = [
  "More {stat} tonight?",
  "Who racks up more {stat}?",
  "Bigger {stat} night?",
  "Who shows out — most {stat}?",
  "Who takes the {stat} edge?",
  "Who piles up more {stat}?",
];

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
  if (!cfg || cfg.stats.length === 0) return null;
  const games = [...input.games].sort((a, b) => a.startMs - b.startMs);
  if (games.length < 2) return null;

  const legs: CrossGameLeg[] = [];
  const usedStems = new Set<string>(); // §3.4 — never repeat a stem on the same slate
  const usedStats = new Set<string>();
  let statIdx = 0;
  let stemIdx = 0;
  // pair consecutive games; each leg draws a DIFFERENT stat (rotating) + a DIFFERENT stem.
  for (let i = 0; i + 1 < games.length && legs.length < H2H_STEMS.length; i += 2) {
    // rotate to the next stat that yields a usable pair for these two games.
    let A: H2HPlayer | null = null, B: H2HPlayer | null = null, stat: H2HStat | null = null;
    for (let s = 0; s < cfg.stats.length; s++) {
      const cand = cfg.stats[(statIdx + s) % cfg.stats.length]!;
      const a = pickTopPlayer(games[i]!, cand.leaderCat);
      const b = pickTopPlayer(games[i + 1]!, cand.leaderCat);
      if (a && b && a.eventId !== b.eventId) { A = a; B = b; stat = cand; statIdx = (statIdx + s + 1) % cfg.stats.length; break; }
    }
    if (!A || !B || !stat) continue;
    // pick the next unused stem (guarantees no repeated stem on this slate — §3.4).
    let stem: string | null = null;
    for (let s = 0; s < H2H_STEMS.length; s++) {
      const cand = H2H_STEMS[(stemIdx + s) % H2H_STEMS.length]!;
      const q = cand.replace("{stat}", stat.statLabel);
      if (!usedStems.has(cand) && !legs.some((l) => l.question === q)) { stem = cand; stemIdx = (stemIdx + s + 1) % H2H_STEMS.length; break; }
    }
    if (!stem) continue;
    usedStems.add(stem);
    usedStats.add(stat.statLabel);
    const probA = lean(A.seasonVal, B.seasonVal);
    legs.push({
      question: stem.replace("{stat}", stat.statLabel),
      optionA: `${A.name} · ${A.team} · ${A.seasonVal} ${stat.statLabel} (season)`,
      optionB: `${B.name} · ${B.team} · ${B.seasonVal} ${stat.statLabel} (season)`,
      probA,
      probB: 100 - probA,
      h2h: { stat: stat.statLabel, boxLabel: stat.boxLabel, a: A, b: B },
    });
  }
  if (!legs.length) return null;
  return {
    slateId: `h2h-${input.league}`,
    title: `${input.category} tonight — head to head`,
    category: input.category,
    lockMs: Math.min(...games.map((g) => g.startMs)),
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
