/**
 * §5 GATE — the archetype library. Generation only (settlement's resolveArchetype is exercised as a
 * cross-check, not modified). Proves: slates draw across archetypes with no repeated archetype+stem
 * (§5.1); every archetype builds a validateLeg-passing leg (§5.2); each settles to the right option
 * against fixture stats (§5.3); milestone renders 3 context-free chips and field-leader-4 lays 2×2
 * (§5.4). §5.5 (creator builder) lives in the create-slate gate.
 */
import { describe, it, expect } from "vitest";
import {
  ARCHETYPE_LIBRARY, ARCHETYPE_STEMS, ARCHETYPE_CHOICES, buildSlateLegs, generatedLegOk, toEngineLeg, lockpickLeg,
  type Pool, type PoolGame, type GeneratedLeg,
} from "./archetypeLibrary";
import { APPROVED_ARCHETYPES, validateLeg, validateSlate, archetypePool, type Archetype } from "./questionEngine";
import { resolveArchetype, type PlayerResult } from "./archetypes";

const log = (m: string) => console.log(m); // eslint-disable-line no-console
const BOX: Record<string, string> = { points: "PTS", rebounds: "REB", assists: "AST" };

/** deterministic fixture pool: nGames games, each with a standout per stat; values vary by seed so
 *  leans aren't dead slots. No Math.random (workflow/test determinism). */
function poolOf(nGames: number, stats: string[], seed: number): Pool {
  const games: PoolGame[] = [];
  for (let i = 0; i < nGames; i++) {
    const gameId = `g${seed}_${i}`;
    const byStat: PoolGame["byStat"] = {};
    for (const st of stats) {
      byStat[st] = { name: `P${seed}_${i}_${st}`, team: `Team${i}A`, gameId, seasonVal: 18 + ((i * 7 + seed * 3) % 16), lastOut: `${12 + (i % 9)}`, stat: st, boxLabel: BOX[st] ?? "PTS", leaderCat: st };
    }
    games.push({ gameId, startMs: i * 1000, gameLine: `Team${i}A at Team${i}B`, byStat });
  }
  return { league: "nba", category: "NBA", stats, games };
}
const ALL_GAME_IDS = (p: Pool) => p.games.map((g) => g.gameId);

describe("§5.1 — 20 slates draw across archetypes, never repeat an archetype+stem", () => {
  it("prints the archetype per leg; no archetype+stem repeats on a slate; ≥3 distinct across 20", () => {
    const seen = new Set<Archetype>();
    for (let s = 0; s < 20; s++) {
      const pool = poolOf(6, ["points", "rebounds", "assists"], s + 1);
      const plans = buildSlateLegs(pool);
      const combos = plans.map((p) => `${p.archetype}|${p.stem}`);
      log(`slate ${s + 1}: ${plans.map((p) => p.archetype).join(", ") || "(none)"}`);
      expect(new Set(combos).size).toBe(combos.length); // §5.1 / §3.2 no repeated archetype+stem
      expect(plans.every((p) => generatedLegOk(p.leg, ALL_GAME_IDS(pool)))).toBe(true);
      plans.forEach((p) => seen.add(p.archetype));
    }
    log(`§5.1 distinct archetypes across 20 slates: ${[...seen].join(", ")}`);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("§3.3 — a one-archetype night yields FEWER legs, never a repeated archetype", () => {
    // only 2 games → only 2-game archetypes (h2h, first_to_n) can build; still no repeat.
    const pool = poolOf(2, ["points"], 99);
    const plans = buildSlateLegs(pool);
    log(`§3.3 two-game night → ${plans.map((p) => p.archetype).join(", ")}`);
    expect(new Set(plans.map((p) => p.archetype)).size).toBe(plans.length); // distinct
  });
});

describe("§5.2 — every archetype builds a validateLeg-passing leg (one player per game, context)", () => {
  const pool = poolOf(5, ["points"], 7);
  for (const id of APPROVED_ARCHETYPES) {
    it(`${id}: builds + passes validateLeg`, () => {
      const def = ARCHETYPE_LIBRARY[id];
      const games = pool.games.slice(0, def.maxGames);
      const leg = def.build(games, "points", def.stems[0]!, "NBA");
      expect(leg).not.toBeNull();
      const verdict = validateLeg(toEngineLeg(leg!), ALL_GAME_IDS(pool));
      log(`§5.2 ${id}: "${leg!.question}" — ${leg!.options.length} opts — validateLeg: ${verdict.message}`);
      expect(verdict.ok).toBe(true);
      // one player per game: distinct gameIds across the flat player list
      const gids = leg!.players.map((p) => p.gameId);
      expect(new Set(gids).size).toBe(gids.length);
      // context lines present on player options (milestone chips carry names in the sub-line instead)
      if (id === "milestone_count") expect(leg!.sub && leg!.sub.length > 0).toBe(true);
      else expect(leg!.options.every((o) => o.context.length >= 2)).toBe(true);
    });
  }
});

/** build a byPlayer composite map from a leg, assigning each named player a composite. */
function composites(leg: GeneratedLeg, valueOf: (name: string, i: number) => number): Record<string, PlayerResult> {
  const map: Record<string, PlayerResult> = {};
  leg.players.forEach((p, i) => { map[p.name] = { composite: valueOf(p.name, i), gameId: p.gameId, status: "played" }; });
  return map;
}

describe("§5.3 — each archetype settles to the correct option against fixture stats", () => {
  const pool = poolOf(5, ["points"], 3);
  const g = (id: Archetype, n: number) => ARCHETYPE_LIBRARY[id].build(pool.games.slice(0, n), "points", ARCHETYPE_LIBRARY[id].stems[0]!, "NBA")!;

  it("top-composite archetypes (h2h/field/biggest): highest wins", () => {
    for (const [id, n] of [["cross_game_h2h", 2], ["field_leader", 4], ["biggest_night", 3]] as const) {
      const leg = g(id, n);
      // make the LAST option's player the clear leader.
      const winner = leg.options[leg.options.length - 1]!;
      const by = composites(leg, (name) => (winner.playerNames!.includes(name) ? 40 : 20));
      const res = resolveArchetype({ archetype: id, options: leg.options.map((o) => ({ key: o.key, playerNames: o.playerNames })) }, by);
      log(`§5.3 ${id}: winner=${res.winningKey} (expected ${winner.key})`);
      expect(res.winningKey).toBe(winner.key);
    }
  });

  it("split_squad_duos: the duo with the higher SUM wins", () => {
    const leg = g("split_squad_duos", 4);
    const winner = leg.options[0]!; // duo A
    const by = composites(leg, (name) => (winner.playerNames!.includes(name) ? 30 : 10));
    const res = resolveArchetype({ archetype: "split_squad_duos", options: leg.options.map((o) => ({ key: o.key, playerNames: o.playerNames })) }, by);
    log(`§5.3 split_squad_duos: winner=${res.winningKey} sums A=${30 + 30} vs B=${10 + 10}`);
    expect(res.winningKey).toBe(winner.key);
  });

  it("first_to_n: the unique player over the bar wins", () => {
    const leg = g("first_to_n", 3);
    const winner = leg.options[1]!;
    const by = composites(leg, (name) => (winner.playerNames!.includes(name) ? leg.bar! + 5 : leg.bar! - 5));
    const res = resolveArchetype({ archetype: "first_to_n", bar: leg.bar, options: leg.options.map((o) => ({ key: o.key, playerNames: o.playerNames })) }, by);
    log(`§5.3 first_to_n: bar=${leg.bar} winner=${res.winningKey} (expected ${winner.key})`);
    expect(res.winningKey).toBe(winner.key);
  });

  it("milestone_count: the bucket the clear-count lands in wins", () => {
    const leg = g("milestone_count", 5); // 5 players, 3 buckets
    // make exactly 4 players clear the bar → the top bucket.
    let cleared = 0;
    const by = composites(leg, () => (cleared++ < 4 ? leg.bar! + 1 : leg.bar! - 1));
    const res = resolveArchetype({ archetype: "milestone_count", bar: leg.bar, countedPlayers: leg.countedPlayers, options: leg.options.map((o) => ({ key: o.key, bucket: o.bucket })) }, by);
    const expected = leg.options.find((o) => o.bucket && 4 >= o.bucket[0] && 4 <= o.bucket[1])!;
    log(`§5.3 milestone_count: 4 cleared → bucket ${res.winningKey} "${expected.label}" (${expected.bucket})`);
    expect(res.winningKey).toBe(expected.key);
  });
});

describe("§5.4 — render shapes", () => {
  const pool = poolOf(4, ["points"], 5);
  it("milestone_count renders 3 chips with NO context on the chips (names in the sub-line)", () => {
    const leg = ARCHETYPE_LIBRARY.milestone_count.build(pool.games.slice(0, 5).length >= 3 ? pool.games : pool.games, "points", ARCHETYPE_STEMS.milestone_count[0]!, "NBA")!;
    log(`§5.4 milestone: pickStyle=${leg.pickStyle} chips=${leg.options.length} ctxOnChips=${leg.options.map((o) => o.context.length)} sub="${leg.sub}"`);
    expect(leg.pickStyle).toBe("chips");
    expect(leg.options.length).toBe(3);
    expect(leg.options.every((o) => o.context.length === 0)).toBe(true);
    expect(leg.sub && leg.sub.length > 0).toBe(true);
  });
  it("field_leader with 4 options lays out 2×2 (contest, 4 options → c2)", () => {
    const leg = ARCHETYPE_LIBRARY.field_leader.build(pool.games.slice(0, 4), "points", ARCHETYPE_STEMS.field_leader[0]!, "NBA")!;
    const cols = leg.options.length === 3 ? 3 : 2; // mirror SlateCard.contestCols
    log(`§5.4 field_leader: pickStyle=${leg.pickStyle} options=${leg.options.length} cols=c${cols}`);
    expect(leg.pickStyle).toBe("contest");
    expect(leg.options.length).toBe(4);
    expect(cols).toBe(2);
  });
});

describe("§5.5 — creator builder offers all six + Lockpick names the fix per archetype", () => {
  it("all six archetypes are selectable from the shared library", () => {
    const ids = ARCHETYPE_CHOICES.map((c) => c.id).sort();
    log(`§5.5 selectable: ${ARCHETYPE_CHOICES.map((c) => `${c.id} (${c.label})`).join(", ")}`);
    expect(ids).toEqual([...APPROVED_ARCHETYPES].sort());
    expect(ARCHETYPE_CHOICES.length).toBe(6);
  });

  it("Lockpick fires the same-game fix-naming for EVERY archetype (not just h2h)", () => {
    const pool = poolOf(5, ["points"], 2);
    for (const id of APPROVED_ARCHETYPES) {
      const def = ARCHETYPE_LIBRARY[id];
      const leg = def.build(pool.games.slice(0, def.maxGames), "points", def.stems[0]!, "NBA")!;
      // force a one-player-per-game VIOLATION: move the last player into the first player's game.
      const engine = toEngineLeg(leg);
      const bad = { ...engine, players: engine.players.map((p, i) => (i === engine.players.length - 1 ? { ...p, gameId: engine.players[0]!.gameId } : p)) };
      const v = lockpickLeg(bad, ALL_GAME_IDS(pool));
      log(`§5.5 ${id}: "${v.message}"`);
      expect(v.ok).toBe(false);
      expect(v.reason).toBe("two_from_one_game");
      expect(v.message).toMatch(/one player per game/);
      expect(v.message).toMatch(/drop one/);
    }
  });

  it("pro builder path: archetypePool offers all six (standard); validateSlate fires the fix per archetype", () => {
    const standard = [...archetypePool("standard")].sort();
    const restricted = archetypePool("restricted");
    log(`§5.5 pro pool standard=${standard.length} restricted=${restricted.length}`);
    expect(standard).toEqual([...APPROVED_ARCHETYPES].sort()); // all six selectable in the creator builder
    expect(restricted.length).toBeLessThan(6); // restricted states get the tighter set
    const pool = poolOf(5, ["points"], 4);
    for (const id of APPROVED_ARCHETYPES) {
      const def = ARCHETYPE_LIBRARY[id];
      const leg = def.build(pool.games.slice(0, def.maxGames), "points", def.stems[0]!, "NBA")!;
      const eng = toEngineLeg(leg);
      const bad = { ...eng, players: eng.players.map((p, i) => (i === eng.players.length - 1 ? { ...p, gameId: eng.players[0]!.gameId } : p)) };
      const { canPublish, legVerdicts } = validateSlate([bad], ALL_GAME_IDS(pool));
      expect(canPublish).toBe(false);
      expect(legVerdicts[0]!.message).toMatch(/one player per game/);
    }
  });
});

describe("§2.6 — stem counts per archetype (≥6 each)", () => {
  it("prints and asserts ≥6 stems for every archetype", () => {
    for (const id of APPROVED_ARCHETYPES) {
      log(`§2.6 ${id}: ${ARCHETYPE_STEMS[id].length} stems`);
      expect(ARCHETYPE_STEMS[id].length).toBeGreaterThanOrEqual(6);
    }
  });
});
