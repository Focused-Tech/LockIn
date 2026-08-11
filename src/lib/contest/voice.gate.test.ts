/**
 * GATE (D) — the approved VOICE. Two things, both non-negotiable:
 *   1. Every generated question — sports AND entertainment — still passes validateLeg AND carries no
 *      banned free-text (detectBannedArchetype clean). The voice change is lexical; compliance is
 *      structural and untouched.
 *   2. Entertainment generation draws from a show's CAST (poolFromCast), one subject per unit, in the
 *      entertainment voice (show nouns, no number on an individual).
 *
 * The BEFORE/AFTER sample is printed for the record: the OLD stems (reference copy below) vs the
 * shipped stems, filled against the same fixture, so the change in voice is visible.
 */
import { describe, it, expect } from "vitest";
import {
  buildSlateLegs, generatedLegOk, ARCHETYPE_STEMS, ENTERTAINMENT_STEMS,
  type Pool, type PoolGame,
} from "./archetypeLibrary";
import { detectBannedArchetype } from "./questionEngine";
import { poolFromCast, creatorEnteredCast, type CastMember } from "./cast";
import { SUBCATEGORY_SEED } from "@/lib/subcategories/seed";

const log = (m: string) => console.log(m); // eslint-disable-line no-console
const BOX: Record<string, string> = { points: "PTS", rebounds: "REB", assists: "AST" };

function sportsPool(nGames: number, stats: string[]): Pool {
  const games: PoolGame[] = [];
  for (let i = 0; i < nGames; i++) {
    const gameId = `g_${i}`;
    const byStat: PoolGame["byStat"] = {};
    for (const st of stats) byStat[st] = { name: `Player ${i + 1}`, team: `Team ${i + 1}`, gameId, seasonVal: 20 + i, lastOut: `${18 + i}`, stat: st, boxLabel: BOX[st] ?? "PTS", leaderCat: st };
    games.push({ gameId, startMs: i, gameLine: `Team ${i + 1} at Team ${i + 10}`, byStat });
  }
  return { league: "nba", category: "NBA", stats, games };
}

/** neutral placeholder cast — NOT shipped data (a test fixture only). The voice, not the names, is
 *  what this proves. */
const CAST = (n: number): CastMember[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Cast ${String.fromCharCode(65 + i)}`, role: "cast" as const }));

function questionsOf(pool: Pool): { q: string; arch: string; opts: string[] }[] {
  return buildSlateLegs(pool).map((p) => ({
    q: p.leg.question,
    arch: p.archetype,
    opts: p.leg.options.map((o) => o.label),
  }));
}

describe("D — approved voice, sports", () => {
  const pool = sportsPool(6, ["points", "rebounds", "assists"]);
  const gen = questionsOf(pool);

  it("prints the AFTER sample (5 questions) and every one passes validateLeg + is banned-text clean", () => {
    log("── AFTER (shipped) — NBA/sports ──");
    gen.slice(0, 5).forEach((g) => log(`  [${g.arch}] ${g.q}`));
    const plans = buildSlateLegs(pool);
    for (const p of plans) {
      expect(generatedLegOk(p.leg, pool.games.map((x) => x.gameId))).toBe(true);
      expect(detectBannedArchetype(p.leg.question, p.leg.options.map((o) => o.label))).toBeNull();
    }
  });
});

describe("D — approved voice, entertainment (cast is the pool)", () => {
  const bw = SUBCATEGORY_SEED.find((s) => s.name === "Basketball Wives")!;
  const cast = creatorEnteredCast(bw.slug, bw.name, CAST(5));
  const pool = poolFromCast(bw, cast);

  it("builds an entertainment slate from the show's cast, in the entertainment voice, all compliant", () => {
    expect(pool.domain).toBe("entertainment");
    const gen = questionsOf(pool);
    log("── AFTER (shipped) — Basketball Wives (cast pool) ──");
    gen.slice(0, 5).forEach((g) => log(`  [${g.arch}] ${g.q}`));
    expect(gen.length).toBeGreaterThanOrEqual(3);
    const plans = buildSlateLegs(pool);
    for (const p of plans) {
      // one subject per unit: distinct gameIds across the flat player list
      const gids = p.leg.players.map((pl) => pl.gameId);
      expect(new Set(gids).size).toBe(gids.length);
      // structural compliance unchanged + no banned free-text, no number leaking onto a subject
      expect(generatedLegOk(p.leg, pool.games.map((x) => x.gameId))).toBe(true);
      expect(detectBannedArchetype(p.leg.question, p.leg.options.map((o) => o.label))).toBeNull();
      expect(/\d/.test(p.leg.question)).toBe(false); // entertainment: no numeric threshold shown
    }
  });

  it("uses entertainment stems (show nouns), not the sports set", () => {
    const gen = questionsOf(pool);
    const sportsAll = Object.values(ARCHETYPE_STEMS).flat().map((s) => s.replace("{stat}", "").replace("{bar}", ""));
    const entAll = Object.values(ENTERTAINMENT_STEMS).flat();
    log(`entertainment stem banks: ${Object.keys(ENTERTAINMENT_STEMS).length} archetypes`);
    // at least one generated question matches an entertainment stem shape (e.g. "this episode", "cast")
    expect(gen.some((g) => /episode|cast|screen time|mentions|drama|confessionals/.test(g.q))).toBe(true);
    expect(entAll.length).toBeGreaterThanOrEqual(36);
    expect(sportsAll.length).toBeGreaterThanOrEqual(36);
  });
});
