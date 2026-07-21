/**
 * FOX PIT — practice trivia pool.
 *
 * Practice slates are KNOWN-ANSWER trivia about SETTLED PAST events. They wear
 * the prediction-slate format (slate / keep-discard / lock / timer) but they are
 * NOT forecasts: the answer is baked at generation time and never rolled.
 *
 * Questions are AI-generated in BATCHES and cached. Deal time reads the cache
 * ONLY — there is never an API call mid-round.
 */
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import type { FoxPitRoomKey } from "@/lib/foxpit";

/** Regenerate the pool on this cadence; the prior batch is archived, not deleted. */
export const TRIVIA_REGEN_INTERVAL_DAYS = 42;

/** How many questions to generate per (category × tier) cell. */
export const TRIVIA_PER_CELL = 12;

/** Options per question — the generator is held to this range. */
export const TRIVIA_MIN_OPTIONS = 2;
export const TRIVIA_MAX_OPTIONS = 4;

/**
 * Difficulty ladder, easiest → hardest, keyed by the room the player is in.
 * The label is handed to the generator verbatim, so it doubles as the spec for
 * how hard that tier should read.
 */
export const TRIVIA_TIERS: Record<FoxPitRoomKey, string> = {
  dojo: "easiest — a casual fan of this category answers correctly without hesitating",
  coliseum: "moderate — a regular follower gets it; a casual fan has to think",
  hightable: "hard — needs real familiarity with the category's history",
  suite: "hardest — a dedicated superfan's question, but still objectively checkable",
};

/** The categories the pool is generated for — the SAME set the player picks from. */
export const TRIVIA_CATEGORIES = CATEGORIES.map((c) => c.name);

/** One cached trivia question. `correctIndex` is the baked answer. */
export interface TriviaQuestion {
  id: string;
  category: string;
  tier: FoxPitRoomKey;
  question: string;
  options: string[];
  correctIndex: number;
  /** One line on WHY that answer is right — shown after the reveal. */
  factNote: string;
  batchId: string;
  generatedAt: number;
}

/**
 * What the model must return per question. Validated at the tool-call boundary
 * so a malformed generation is rejected loudly instead of poisoning the cache.
 */
export const generatedQuestionSchema = z
  .object({
    question: z.string().min(8).max(240),
    options: z.array(z.string().min(1).max(120)).min(TRIVIA_MIN_OPTIONS).max(TRIVIA_MAX_OPTIONS),
    correctIndex: z.number().int().min(0),
    factNote: z.string().min(8).max(300),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: "correctIndex must point at a real option",
  })
  .refine((q) => new Set(q.options).size === q.options.length, {
    message: "options must be distinct",
  });

export const generatedBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/** JSON Schema handed to the model as a forced tool — mirrors the zod shape above. */
export const TRIVIA_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array",
      description: `Exactly ${TRIVIA_PER_CELL} trivia questions.`,
      items: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description:
              "A question about a SETTLED past event with one objectively correct answer. Never about anything undecided or upcoming.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: TRIVIA_MIN_OPTIONS,
            maxItems: TRIVIA_MAX_OPTIONS,
            description: "Distinct answer options. Wrong options must be plausible, not filler.",
          },
          correctIndex: {
            type: "integer",
            description: "0-based index into options of the correct answer.",
          },
          factNote: {
            type: "string",
            description: "One sentence stating the fact that makes the answer correct.",
          },
        },
        required: ["question", "options", "correctIndex", "factNote"],
      },
    },
  },
  required: ["questions"],
};

/** Has this batch aged out? */
export function batchIsStale(generatedAt: number, now: number): boolean {
  return now - generatedAt >= TRIVIA_REGEN_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}
