/**
 * CROSS-GAME ARCHETYPE RESOLUTION (§2.2 + §2.3) — pure logic, no I/O.
 *
 * §2.2 ONE composite, ONE place: every archetype resolves against FANTASY POINTS. A player's
 * composite = Σ (stat × weight) with the per-sport weights imported from architectSet.ts (never
 * inlined). §2.3 resolves each approved archetype against that composite. §2.4 edge cases route
 * through crossGameEdge.ts. Real stats are supplied by the caller (fixtures in the gate; the live
 * feed carries no player stats yet — §1.2 blocker).
 */
import { SCORING_WEIGHTS, type ScoringSport } from "./architectSet";
import type { Archetype } from "./questionEngine";
import { applyEdgeEligibility, highestOrTie, type OptionResult, type OptionStatus, type EdgeReason } from "./crossGameEdge";

/** §2.2 — the composite. Σ stat × per-sport weight. Unknown stats contribute 0. */
export function fantasyPoints(sport: ScoringSport, stats: Record<string, number>): number {
  const weights = SCORING_WEIGHTS[sport];
  let pts = 0;
  for (const [stat, value] of Object.entries(stats)) {
    const w = weights[stat];
    if (typeof w === "number") pts += value * w;
  }
  return Math.round(pts * 100) / 100;
}

/** A named player's settled line: their composite, which game they were in, and whether they played. */
export interface PlayerResult {
  composite: number;
  gameId: string;
  status: OptionStatus;
}

/** An option the entry can pick. Player-based archetypes: one player per option. Duos: 2 players.
 *  Milestone: a count bucket [min,max]. */
export interface LegOption {
  key: string;
  playerNames?: string[];
  bucket?: [number, number];
}

export interface CrossGameLeg {
  archetype: Archetype;
  options: LegOption[];
  /** first-to-N target / milestone bar, on the composite. */
  bar?: number;
  /** milestone_count: the players whose bar-clears are tallied (defaults to all option players). */
  countedPlayers?: string[];
}

export interface ArchetypeResolution {
  /** the winning option key an entry's pick.choice must match, or null when the leg voids. */
  winningKey: string | null;
  voidLeg: boolean;
  reason: EdgeReason | "no_reach" | "misconfigured" | null;
}

/** Roll a player-based option up to an OptionResult (a duo sums its players; DNP/postponed propagate). */
function optionResult(opt: LegOption, byPlayer: Record<string, PlayerResult>): OptionResult {
  const names = opt.playerNames ?? [];
  const rs = names.map((n) => byPlayer[n]).filter((r): r is PlayerResult => !!r);
  const status: OptionStatus = rs.some((r) => r.status === "postponed")
    ? "postponed"
    : rs.length < names.length || rs.some((r) => r.status === "dnp")
      ? "dnp"
      : "played";
  const composite = rs.reduce((s, r) => s + r.composite, 0);
  const gameId = rs[0]?.gameId ?? "";
  return { key: opt.key, gameId, composite, status };
}

/**
 * §2.3 — resolve one leg to its winning option key (or void). Every archetype uses the SAME
 * composite; the only difference is how options roll up and how the winner is chosen.
 */
export function resolveArchetype(leg: CrossGameLeg, byPlayer: Record<string, PlayerResult>): ArchetypeResolution {
  switch (leg.archetype) {
    // higher composite of the two / highest among the field / biggest night — all "top composite".
    case "cross_game_h2h":
    case "field_leader":
    case "biggest_night":
    case "split_squad_duos": {
      const results = leg.options.map((o) => optionResult(o, byPlayer));
      const { eligible, voidLeg, reason } = applyEdgeEligibility(results);
      if (voidLeg) return { winningKey: null, voidLeg: true, reason };
      const { winner, tie } = highestOrTie(eligible);
      if (tie || !winner) return { winningKey: null, voidLeg: true, reason: "tie" };
      return { winningKey: winner.key, voidLeg: false, reason: null };
    }
    // first player to reach N composite. Final box scores carry no in-game ORDER, so a unique
    // reacher wins; 0 reachers or a multi-reach (order undeterminable without play-by-play) → void.
    case "first_to_n": {
      const bar = leg.bar ?? Infinity;
      const results = leg.options.map((o) => optionResult(o, byPlayer));
      const { eligible, voidLeg, reason } = applyEdgeEligibility(results);
      if (voidLeg) return { winningKey: null, voidLeg: true, reason };
      const reached = eligible.filter((o) => o.composite >= bar);
      if (reached.length === 0) return { winningKey: null, voidLeg: true, reason: "no_reach" };
      if (reached.length > 1) return { winningKey: null, voidLeg: true, reason: "tie" };
      return { winningKey: reached[0]!.key, voidLeg: false, reason: null };
    }
    // count how many named players cleared the bar → the bucket [min,max] that count lands in.
    case "milestone_count": {
      const bar = leg.bar ?? Infinity;
      const counted = leg.countedPlayers ?? leg.options.flatMap((o) => o.playerNames ?? []);
      const lines = counted.map((n) => byPlayer[n]).filter((r): r is PlayerResult => !!r);
      if (lines.some((r) => r.status === "postponed")) return { winningKey: null, voidLeg: true, reason: "postponed" };
      // DNP players simply didn't clear the bar (conservative: a scratch is not a clear).
      const cleared = lines.filter((r) => r.status === "played" && r.composite >= bar).length;
      const bucket = leg.options.find((o) => o.bucket && cleared >= o.bucket[0] && cleared <= o.bucket[1]);
      if (!bucket) return { winningKey: null, voidLeg: true, reason: "misconfigured" };
      return { winningKey: bucket.key, voidLeg: false, reason: null };
    }
    default:
      return { winningKey: null, voidLeg: true, reason: "misconfigured" };
  }
}
