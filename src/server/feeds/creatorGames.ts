/* eslint-disable @typescript-eslint/no-explicit-any -- ESPN endpoints return untyped, sprawling JSON; parsed defensively here. */
/**
 * TONIGHT'S GAMES for the creator builder (§1.1/§1.3/§1.4/§1.5). Live from ESPN via the stats
 * provider — no seed, no fallback (§1.C). A fetch failure THROWS; the page turns that into a visible
 * error (never stale seed players).
 *
 * Batched (§1.D): one scoreboard call + one roster call per game (provider-cached 12h). Player
 * context (season avg + last-out) is a separate on-demand batch when a leg's players are chosen —
 * never per keystroke, and never on the 15s schedule TTL.
 */
import "server-only";
import { EspnStatsProvider, type StatsProvider } from "./statsProvider";
import type { CreatorGame } from "@/lib/contest/games";

// §3.1 — WNBA scoreboard (in-season; NBA is out of season). Flip to nba when the NBA season returns.
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard";

function tipoffLabel(startMs: number): string {
  // display-only ET clock (games are US-scheduled); never renders odds (§1.E).
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(startMs)).replace(" ", "").toLowerCase();
  } catch {
    return "";
  }
}

/** Today's NBA games with LIVE rosters. Throws on a feed failure (§1.C — the page surfaces it). */
export async function getTodaysCreatorGames(provider: StatsProvider = EspnStatsProvider): Promise<CreatorGame[]> {
  // schedule cache: 15 min (schedules move rarely intraday; NOT the 15s TTL, NOT the stats TTL).
  const res = await fetch(SCOREBOARD, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
  const j = (await res.json()) as any;
  const events: any[] = j?.events ?? [];

  return Promise.all(
    events.map(async (ev): Promise<CreatorGame> => {
      const id = String(ev.id);
      const comp = ev?.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home")?.team?.shortDisplayName ?? "Home";
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away")?.team?.shortDisplayName ?? "Away";
      const startMs = new Date(ev.date).getTime();
      const rosters = await provider.rostersForGame(id, "basketball");
      const players = rosters.teams.flatMap((t) =>
        t.players.filter((p) => p.active).map((p) => ({ name: p.name, team: t.team, playerId: p.id })),
      );
      return { id, away, home, tipoff: tipoffLabel(startMs), startMs, sport: "basketball", players };
    }),
  );
}

export interface PlayerContext {
  playerId: string;
  seasonAverage: string;
  last3Form: string;
}

/** §1.2 — season average + last-out form for a leg's players (a batch, on demand). Basketball. */
export async function getPlayerContext(playerIds: string[], provider: StatsProvider = EspnStatsProvider): Promise<PlayerContext[]> {
  if (playerIds.length === 0) return [];
  const [avgs, form] = await Promise.all([
    provider.seasonAverages(playerIds, "basketball"),
    provider.recentForm(playerIds, "basketball", 3),
  ]);
  const avgById = new Map(avgs.map((a) => [a.playerId, a.stats]));
  const formById = new Map(form.map((f) => [f.playerId, f.games]));
  return playerIds.map((playerId) => {
    const s = avgById.get(playerId) ?? {};
    const seasonAverage = `${round1(s.avgPoints ?? s.points)} pts · ${round1(s.avgRebounds ?? s.rebounds)} reb · ${round1(s.avgAssists ?? s.assists)} ast`;
    const games = formById.get(playerId) ?? [];
    const last3Form = games.length
      ? `Last ${games.length}: ${games.map((g) => Math.round(g.PTS ?? g.points ?? 0)).join(", ")} pts`
      : "No recent games";
    return { playerId, seasonAverage, last3Form };
  });
}

function round1(n: number | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : "—";
}