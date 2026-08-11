/**
 * CAST AS THE PLAYER POOL (C) — the entertainment mirror of the sports roster pool.
 *
 * SPORTS (wired): the subject pool is a live ESPN roster. `getTodaysCreatorGames()`
 * (server/feeds/creatorGames.ts) → `CreatorGame.players: CreatorGamePlayer[]` = `{ name, team,
 * playerId }`, and the feed builds a Pool from it with `poolFromGames` (server/feeds/crossGame.ts).
 * Question generation draws its subjects from THAT roster.
 *
 * ENTERTAINMENT: once a show is chosen (a subcategory, B), generation must draw from THAT SHOW'S
 * CAST — the reality stars / judges / hosts — exactly as athletes work for sports. This module mirrors
 * that shape: `CastMember` ↔ `CreatorGamePlayer`, `ShowCast` ↔ `CreatorGame`, `CastProvider` ↔
 * `StatsProvider`, and `poolFromCast` ↔ `poolFromGames`.
 *
 * ── NO CAST DATA SOURCE EXISTS YET (honest report, C.b) ──────────────────────────────────────────
 * There is no wired entertainment/cast API in this codebase (ESPN is sports-only). So NO cast lists
 * are invented here. The interim provider is `CreatorEnteredCastProvider`: the creator supplies the
 * cast for their show (they know it), stored on the subcategory / slate. Recommended real sources to
 * wire later, in order of fit:
 *   1. TMDB `/tv/{id}/aggregate_credits` — full cast+crew per show/season, free API key. Best fit.
 *   2. Wikidata / Wikipedia cast infoboxes — no key, messier parse.
 *   3. Network EPG / press-site cast pages — per-network, brittle.
 * When one is wired, implement `CastProvider.castForShow` against it; nothing else here changes.
 *
 * The COMPLIANCE unit: for sports the "unit" a subject occupies is the GAME (one player per game);
 * for entertainment it is the SUBJECT themself — each cast member is their own unit, so a within-
 * episode comparison of two cast members satisfies one-subject-per-unit exactly as one-player-per-game
 * does. `poolFromCast` gives each subject a distinct gameId, so validateLeg passes structurally.
 */
import type { Pool, PoolGame, PoolPlayer } from "./archetypeLibrary";
import type { Subcategory } from "@/lib/subcategories/types";

/** A selectable subject on a show. Mirrors CreatorGamePlayer. Judges / hosts / recurring non-
 *  contestant figures are valid subjects (C.c) — `role` marks them. `castId` is the external id once a
 *  cast provider is wired (TMDB person id, etc.); optional for creator-entered cast. */
export interface CastMember {
  name: string;
  role: "cast" | "judge" | "host" | "recurring";
  castId?: string;
}

/** One show/episode unit's cast. Mirrors CreatorGame (`players` → `subjects`). */
export interface ShowCast {
  /** the subcategory slug this cast belongs to. */
  showSlug: string;
  showName: string;
  subjects: CastMember[];
}

/**
 * The entertainment analog of StatsProvider — the ONE seam a real cast API implements later. Kept
 * minimal on purpose: entertainment has no live box score, so there is no season/final-stats method
 * (settlement for entertainment is creator/manual review, TODO). Only the roster method exists.
 */
export interface CastProvider {
  /** the cast for a show. Throws or returns [] when unavailable — callers must handle the empty case
   *  (an entertainment slate with no cast cannot generate). */
  castForShow(showSlug: string): Promise<ShowCast | null>;
}

/**
 * Interim provider: NO API, NO invented names. The creator supplies the cast; this just wraps what
 * they entered (or what a subcategory doc has stored). Swap for a real `CastProvider` when a source
 * (TMDB, above) is wired.
 */
export function creatorEnteredCast(showSlug: string, showName: string, members: CastMember[]): ShowCast {
  return { showSlug, showName, subjects: members.filter((m) => m.name.trim().length > 0) };
}

const subjectSlug = (name: string) => name.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

/**
 * Build a generation Pool from a show's cast — the entertainment mirror of `poolFromGames`. Each
 * subject becomes its own unit (distinct gameId), so one-subject-per-unit holds. Every subject is
 * available for EVERY stat in the subcategory's vocabulary (a person can be compared on screen time,
 * mentions, drama…), so the diverse-archetype selector can build across stats just like sports.
 * `domain: "entertainment"` routes stem-filling to the entertainment voice. seasonVal is 0 (no numbers
 * on individuals) — option context stays qualitative.
 */
export function poolFromCast(sub: Subcategory, cast: ShowCast): Pool {
  const stats = sub.stats.map((s) => s.stat);
  const games: PoolGame[] = cast.subjects.map((m, i) => {
    const gameId = `${sub.slug}:${subjectSlug(m.name)}`;
    const byStat: Record<string, PoolPlayer> = {};
    for (const st of stats) {
      byStat[st] = {
        name: m.name,
        team: m.role === "cast" ? cast.showName : `${cast.showName} · ${m.role}`,
        gameId,
        seasonVal: 0,
        lastOut: "",
        stat: st,
        boxLabel: "",
        leaderCat: st,
        // playerId carries the external id exactly as sports carries the ESPN athlete id (once a cast
        // provider is wired). Undefined for creator-entered cast.
        playerId: m.castId,
      };
    }
    return { gameId, startMs: i, gameLine: cast.showName, byStat };
  });
  return { league: sub.slug, category: sub.category, stats, games, domain: "entertainment" };
}
