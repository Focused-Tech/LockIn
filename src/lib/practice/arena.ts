/**
 * ARENA — client-side helpers for the Parlay round (play-money, SCORE only).
 *
 * Pure + client-safe. The arena orchestrator (ArenaSession) composes the EXISTING
 * per-contest server actions (createPracticeContest / submitPracticePicks) — this
 * module just shapes the selectable slate previews, assigns each a synthetic
 * event-time so reveals have a well-defined order, and provides a curated local
 * fallback slate for when AI generation is unavailable (so the flow always runs).
 */

import { AI_CREATORS } from "./creators";
import { PRACTICE_CONFIG } from "./config";
import type { Choice } from "./scoring";
import type { PracticeLeg } from "@/lib/firebase/types";

export type ArenaDifficulty = "easy" | "medium" | "hard";

/** A selectable slate on the "Add to round" screen (before it's generated). */
export interface ArenaSlatePreview {
  /** Stable client key: `${creatorId}:${category}`. */
  key: string;
  creatorId: string;
  creatorName: string;
  handle: string;
  avatar: string;
  accent: string;
  category: string;
  difficulty: ArenaDifficulty;
  styleNote: string;
  /** Nominal leg count (display + local-fallback size). */
  legCount: number;
  /** Synthetic event minutes-past-midnight — reveals run earliest-first. */
  eventMinutes: number;
  /** Human event-time label, e.g. "7:30 PM". */
  eventLabel: string;
}

/** Small stable hash (no randomness) for deterministic event-time assignment. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const NOMINAL_LEGS: Record<ArenaDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

function minutesToLabel(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * All slate previews available for the chosen categories — one per (AI creator,
 * category) pairing the creator covers. Each gets a deterministic synthetic event
 * time (evening slots) so "reveal in event-time order" is well-defined.
 */
export function buildSlatePreviews(categories: string[]): ArenaSlatePreview[] {
  const chosen = new Set(categories);
  const out: ArenaSlatePreview[] = [];
  for (const c of AI_CREATORS) {
    for (const cat of c.categories) {
      if (!chosen.has(cat)) continue;
      const key = `${c.id}:${cat}`;
      // Evening slots 7:00–9:30 PM in 30-min steps (deterministic per slate).
      const eventMinutes = 19 * 60 + (hash(key) % 6) * 30;
      out.push({
        key,
        creatorId: c.id,
        creatorName: c.name,
        handle: c.handle,
        avatar: c.avatar,
        accent: c.accent,
        category: cat,
        difficulty: c.difficulty,
        styleNote: c.styleNote,
        legCount: NOMINAL_LEGS[c.difficulty],
        eventMinutes,
        eventLabel: minutesToLabel(eventMinutes),
      });
    }
  }
  return out;
}

/** Event-time order (earliest first); ties broken by key for stability. */
export function byEventTime(
  a: ArenaSlatePreview,
  b: ArenaSlatePreview,
): number {
  return a.eventMinutes - b.eventMinutes || (a.key < b.key ? -1 : 1);
}

/** Result of playing one slate in a round (real or local fallback). */
export interface ArenaPlayed {
  preview: ArenaSlatePreview;
  legs: PracticeLeg[];
  picks: Choice[];
  outcomes: Choice[];
  hits: boolean[];
  correct: number;
  net: number;
  won: boolean;
  perfect: boolean;
  /** How the slate was sourced/settled. `skipped` = couldn't stake (e.g. busted). */
  source: "real" | "local" | "skipped";
}

/**
 * Curated LOCAL slate — the fallback when AI generation is unavailable, so the
 * arena flow always demonstrates end-to-end. Legs + hidden outcomes are rolled
 * here (weighted by probability, exactly like the server) and scored client-side.
 */
export function buildLocalSlate(preview: ArenaSlatePreview): {
  legs: PracticeLeg[];
  outcomes: Choice[];
} {
  const n = preview.legCount;
  const diffs: ArenaDifficulty[] = ["easy", "medium", "hard"];
  const legs: PracticeLeg[] = Array.from({ length: n }, (_, i) => {
    // Favorites lean easier; underdog-lean creators push probabilities to the
    // coin-flip range. Purely cosmetic for a fallback.
    const base =
      preview.difficulty === "easy" ? 68 : preview.difficulty === "hard" ? 54 : 61;
    const probA = Math.max(50, Math.min(80, base - (i % 3) * 4));
    return {
      id: `l${i}`,
      question: `${preview.category} · call ${i + 1}: does the favorite hold?`,
      optionA: "Favorite",
      optionB: "Underdog",
      probA,
      probB: 100 - probA,
      type: "binary",
      line: null,
      difficulty: diffs[i % 3]!,
    };
  });
  const outcomes: Choice[] = legs.map((l) =>
    Math.random() * 100 < l.probA ? "a" : "b",
  );
  return { legs, outcomes };
}

export const ARENA = PRACTICE_CONFIG.arena;
