/**
 * PRACTICE SLATE GENERATOR (client-safe, pure).
 *
 * The single source of every practice slate — BOTH the client-side arena fallback
 * (`buildLocalSlate`) and the server host action (`createPracticeContest`) call this,
 * so practice questions come from the shared ARCHETYPE LIBRARY (the same one the feed
 * and creator builder use), not a bespoke binary generator. It:
 *   1. draws archetype legs across the diverse order (never one archetype repeated),
 *   2. gives every option a consensus % (the meter/percentage the card renders),
 *   3. pre-rolls the hidden outcome per leg (weighted by those %s) for instant settle.
 *
 * Every leg it emits passes the same `validateLeg` the entry path runs (one player per
 * game per leg, approved archetypes only) — enforced inside `buildSlateLegs`.
 */
import type { Archetype } from "@/lib/contest/questionEngine";
import {
  buildSlateLegs,
  type GeneratedLeg,
  type GeneratedOption,
} from "@/lib/contest/archetypeLibrary";
import { rosterPool } from "./roster";
import type { PracticeLeg, PracticeOption, PracticeOptionContext } from "@/lib/firebase/types";

/** Short uppercase archetype tag for the card head (§2). */
export const ARCHETYPE_TAG: Record<string, string> = {
  cross_game_h2h: "Head-to-head",
  field_leader: "Field leader",
  biggest_night: "Biggest night",
  split_squad_duos: "Split-squad duos",
  milestone_count: "Milestone count",
  first_to_n: "First to N",
  manual: "Custom",
};

/** Parse the archetype option's context strings ([gameLine, "N stat (season)", "X last out"])
 *  into the leg's per-option {gameLine, seasonAvg, lastOut}. Missing pieces → "". */
function parseContext(cx: string[]): PracticeOptionContext {
  return { gameLine: cx[0] ?? "", seasonAvg: cx[1] ?? "", lastOut: cx[2] ?? "" };
}

/** Pull the leading number out of a context string ("27 points (season)" → 27); 0 if none. */
function leadNum(s: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  return m ? parseFloat(m[1]!) : 0;
}

/** Sharpen (>1) or flatten (<1) toward/away from the favorite by difficulty. */
const SPREAD_EXP: Record<"easy" | "medium" | "hard", number> = { easy: 1.5, medium: 1.0, hard: 0.65 };

/**
 * Consensus percentages for a leg's options — weighted by each option's season form
 * (so the meter reads like a real crowd), sharpened for easy legs and flattened for
 * hard ones. Chips (milestone buckets) have no per-option form, so the middle bucket
 * leads. Always integers, each ≥ 5, summing to exactly 100.
 */
function consensusPercents(leg: GeneratedLeg, difficulty: "easy" | "medium" | "hard"): number[] {
  const opts = leg.options;
  const n = opts.length;
  let weights: number[];
  if (leg.pickStyle === "chips") {
    // 3-bucket milestone: middle likeliest; generalizes to a mild center bias.
    weights = opts.map((_, i) => 1 + (i === Math.floor(n / 2) ? 0.5 : 0));
  } else {
    const vals = opts.map((o) => leadNum(o.context[1] ?? ""));
    const anyVal = vals.some((v) => v > 0);
    const base = anyVal ? vals.map((v) => Math.max(v, 0.1)) : opts.map(() => 1);
    const exp = SPREAD_EXP[difficulty];
    weights = base.map((w) => Math.pow(w, exp));
  }
  return normalizeToPercents(weights, 5);
}

/** Turn positive weights into integer percentages ≥ minPct that sum to exactly 100. */
export function normalizeToPercents(weights: number[], minPct = 5): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0) || n;
  // Floor at minPct, then distribute the remaining budget proportionally.
  const budget = 100 - minPct * n;
  const raw = weights.map((w) => minPct + (budget * w) / sum);
  const floored = raw.map((r) => Math.floor(r));
  let rem = 100 - floored.reduce((a, b) => a + b, 0);
  // Hand the leftover units to the largest fractional parts.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (let k = 0; k < order.length && rem > 0; k++, rem--) out[order[k]!.i]! += 1;
  return out;
}

/** Roll a weighted outcome index from percentages (0..99 rng). */
function rollOutcome(percents: number[], rng: () => number): number {
  const r = rng() * 100;
  let acc = 0;
  for (let i = 0; i < percents.length; i++) {
    acc += percents[i]!;
    if (r < acc) return i;
  }
  return percents.length - 1;
}

function toOption(o: GeneratedOption, prob: number): PracticeOption {
  return { label: o.label, prob, context: parseContext(o.context) };
}

export interface GeneratedPracticeSlate {
  legs: PracticeLeg[];
  /** Hidden pre-rolled outcome index per leg (parallel to `legs`). */
  outcomes: number[];
}

/**
 * Build a practice slate for a category from the archetype library. `legCount` caps
 * the legs (difficulty-driven); `rng` defaults to Math.random (pass a seeded rng in
 * tests). Returns compliant N-option legs + their hidden outcome indexes.
 */
export function buildPracticeSlate(
  category: string,
  legCount: number,
  rng: () => number = Math.random,
): GeneratedPracticeSlate {
  const pool = rosterPool(category);
  const plans = buildSlateLegs(pool, { maxLegs: Math.max(2, legCount) });
  const diffs: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];
  const legs: PracticeLeg[] = [];
  const outcomes: number[] = [];
  plans.forEach(({ leg }, i) => {
    const difficulty = diffs[i % 3]!;
    const percents = consensusPercents(leg, difficulty);
    const options = leg.options.map((o, k) => toOption(o, percents[k]!));
    legs.push({
      id: `g${i}`,
      question: leg.question,
      ...(leg.sub ? { sub: leg.sub } : {}),
      options,
      archetype: leg.archetype,
      difficulty,
    });
    outcomes.push(rollOutcome(percents, rng));
  });
  return { legs, outcomes };
}

export type { Archetype };
