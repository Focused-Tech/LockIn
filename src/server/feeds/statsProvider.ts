/* eslint-disable @typescript-eslint/no-explicit-any -- ESPN endpoints return untyped, sprawling JSON; parsed defensively here. */
/**
 * STATS PROVIDER (§1.B) — the ONE module every consumer goes through for player data. Nothing else
 * calls ESPN directly, so a broken endpoint is one file to fix. Implementation is ESPN (verified,
 * unkeyed endpoints — §1.A); FixtureStatsProvider is the test double for the gates only.
 *
 * Endpoints are UNDOCUMENTED / no SLA (§1.F). Known fragilities handled here:
 *  - roster shape differs by league (NBA flat athletes[]; others nest athletes[].items[]).
 *  - box-score stats[] is POSITIONAL against labels[] — mapped by label string, never by index.
 *
 * NO PROPS. We read box-score / season STATS (counting stats), never over/under prop lines.
 */
import type { ScoringSport } from "@/lib/contest/architectSet";

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  /** false = inactive / injured / not with the team (from ESPN status/injuries). */
  active: boolean;
}
export interface GameRosters {
  gameId: string;
  sport: ScoringSport;
  teams: { team: string; players: RosterPlayer[] }[];
}
/** Stat lines are keyed to our SCORING_WEIGHTS keys (points, rebounds, …), not ESPN's labels. */
export interface StatLine {
  playerId: string;
  stats: Record<string, number>;
}
export interface FinalStat extends StatLine {
  didNotPlay: boolean;
}

export interface StatsProvider {
  rostersForGame(gameId: string, sport?: ScoringSport): Promise<GameRosters>;
  seasonAverages(playerIds: string[], sport?: ScoringSport): Promise<StatLine[]>;
  recentForm(playerIds: string[], sport?: ScoringSport, games?: number): Promise<{ playerId: string; games: Record<string, number>[] }[]>;
  finalStats(gameId: string, sport?: ScoringSport): Promise<FinalStat[]>;
}

// ── ESPN label → our stat-key maps (per sport; §1.F: brittle if ESPN reorders — mapped by name) ──
const LEAGUE: Record<ScoringSport, { sport: string; league: string }> = {
  // §3.1 — WNBA is the IN-SEASON basketball league (NBA is out of season). Same box-score labels +
  // flat rosters as NBA (verified), so SCORING_WEIGHTS.basketball + BOX_LABEL_MAP.basketball apply
  // unchanged. Flip to "nba" when the NBA season returns.
  basketball: { sport: "basketball", league: "wnba" },
  football: { sport: "football", league: "nfl" },
  baseball: { sport: "baseball", league: "mlb" },
  hockey: { sport: "hockey", league: "nhl" },
  soccer: { sport: "soccer", league: "usa.1" },
};
/** box-score column label → our stat key. Extend per sport; unmapped columns are ignored. */
const BOX_LABEL_MAP: Partial<Record<ScoringSport, Record<string, string>>> = {
  basketball: { PTS: "points", REB: "rebounds", AST: "assists", STL: "steals", BLK: "blocks", TO: "turnovers", "3PT": "threes" },
};

async function espn<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** "3-10" → the made value (3); a bare number → itself; anything else → 0. */
function madeValue(raw: string): number {
  if (raw == null) return 0;
  const s = String(raw);
  if (s.includes("-")) return Number(s.split("-")[0]) || 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ESPN implementation. Cache TTLs (§1.D): rosters 12h, season averages 24h, recent form 1h, final
 * stats 5m (near-final). Cache KEY is the request URL (Next fetch cache). Schedules keep their
 * existing 15s revalidate elsewhere (slates.ts:77-81) — stats are NEVER on a 15s TTL.
 */
export const EspnStatsProvider: StatsProvider = {
  async rostersForGame(gameId, sport = "basketball") {
    const { sport: sp, league } = LEAGUE[sport];
    // the game's two teams come from the box-score summary; then one roster fetch per team.
    const summary = await espn<any>(`https://site.web.api.espn.com/apis/site/v2/sports/${sp}/${league}/summary?event=${gameId}`, 43200);
    const comp = summary?.header?.competitions?.[0] ?? summary?.boxscore?.teams;
    const teamAbbrs: string[] = (summary?.boxscore?.teams ?? []).map((t: any) => t?.team?.abbreviation).filter(Boolean);
    const teams = await Promise.all(
      teamAbbrs.map(async (abbr: string) => {
        const r = await espn<any>(`https://site.api.espn.com/apis/site/v2/sports/${sp}/${league}/teams/${abbr.toLowerCase()}/roster`, 43200);
        const flat: any[] = Array.isArray(r?.athletes) && r.athletes[0]?.items ? r.athletes.flatMap((g: any) => g.items) : (r?.athletes ?? []);
        const players: RosterPlayer[] = flat.map((a: any) => ({
          id: String(a.id),
          name: a.fullName ?? a.displayName ?? "",
          position: a.position?.abbreviation ?? "",
          active: (a.status?.type ?? a.status?.name ?? "active").toString().toLowerCase().includes("active") && !(a.injuries?.length > 0 && a.injuries[0]?.status === "Out"),
        }));
        return { team: abbr, players };
      }),
    );
    void comp;
    return { gameId, sport, teams };
  },

  async seasonAverages(playerIds, sport = "basketball") {
    const { sport: sp, league } = LEAGUE[sport];
    return Promise.all(
      playerIds.map(async (playerId) => {
        const o = await espn<any>(`https://site.api.espn.com/apis/common/v3/sports/${sp}/${league}/athletes/${playerId}/overview`, 86400);
        const names: string[] = o?.statistics?.names ?? [];
        const values: string[] = o?.statistics?.splits?.[0]?.stats ?? o?.statistics?.splits ?? [];
        const stats: Record<string, number> = {};
        names.forEach((n, i) => { stats[n] = Number(values[i]) || 0; });
        return { playerId, stats };
      }),
    );
  },

  async recentForm(playerIds, sport = "basketball", games = 3) {
    const { sport: sp, league } = LEAGUE[sport];
    return Promise.all(
      playerIds.map(async (playerId) => {
        const o = await espn<any>(`https://site.api.espn.com/apis/common/v3/sports/${sp}/${league}/athletes/${playerId}/overview`, 3600);
        const labels: string[] = o?.gameLog?.labels ?? o?.gameLog?.statistics?.names ?? [];
        const events: any[] = (o?.gameLog?.events ? Object.values(o.gameLog.events) : o?.gameLog?.statistics?.events ?? []).slice(0, games);
        const rows = events.map((ev: any) => {
          const raw: string[] = ev?.stats ?? [];
          const row: Record<string, number> = {};
          labels.forEach((l, i) => { row[l] = madeValue(raw[i]!); });
          return row;
        });
        return { playerId, games: rows };
      }),
    );
  },

  async finalStats(gameId, sport = "basketball") {
    const { sport: sp, league } = LEAGUE[sport];
    const map = BOX_LABEL_MAP[sport] ?? {};
    const s = await espn<any>(`https://site.web.api.espn.com/apis/site/v2/sports/${sp}/${league}/summary?event=${gameId}`, 300);
    const out: FinalStat[] = [];
    for (const teamBlock of s?.boxscore?.players ?? []) {
      const stat = teamBlock?.statistics?.[0];
      const labels: string[] = stat?.labels ?? [];
      for (const row of stat?.athletes ?? []) {
        const raw: string[] = row?.stats ?? [];
        const stats: Record<string, number> = {};
        labels.forEach((l, i) => { const key = map[l]; if (key) stats[key] = madeValue(raw[i]!); });
        out.push({ playerId: String(row?.athlete?.id ?? ""), stats, didNotPlay: !!row?.didNotPlay });
      }
    }
    return out;
  },
};