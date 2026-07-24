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
export const TRIVIA_REGEN_INTERVAL_DAYS = 22;

/** How many questions to generate per (category × tier) cell. */
export const TRIVIA_PER_CELL = 12;

/** Options per question — the generator is held to this range. */
export const TRIVIA_MIN_OPTIONS = 2;
export const TRIVIA_MAX_OPTIONS = 4;

/**
 * Difficulty ladder, easiest → hardest, keyed by the room. Difficulty scales by DECOY QUALITY,
 * not by obscurity — a famous fact with genuinely plausible alternatives is harder than an
 * obscure fact with one absurd option. The label is handed to the generator verbatim.
 */
export const TRIVIA_TIERS: Record<FoxPitRoomKey, string> = {
  dojo: "2 options, well-known facts — any follower of the category gets it right away",
  coliseum: "3 options, one genuinely plausible decoy a casual fan might fall for",
  hightable: "4 options, specifics — exact years, margins, chart positions, runners-up; all four options are plausible to a fan",
  suite: "4 options, expert tier — precise figures and second-order details; distractors are near-misses only an expert rules out",
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

/**
 * POLITICS RULE (part 5): a political question must NAME its specifics — a real candidate/
 * officeholder OR a real bill/law/measure by name — AND include a year. Vague framing
 * ("Did the Senate pass the infrastructure bill?") is rejected; specific framing
 * ("In 2021, the Infrastructure Investment and Jobs Act passed the Senate by what margin?")
 * is accepted. Heuristic validator: drop any political item lacking a year plus a named
 * measure or a proper-noun person.
 */
export function politicalQuestionOk(question: string): boolean {
  const hasYear = /\b(1[89]|20)\d{2}\b/.test(question);
  const hasNamedMeasure =
    /\b(Act|Bill|Amendment|Resolution|Law|Measure|Proposition|Initiative|Treaty|Accord|Executive Order|Referendum)\b/.test(question);
  // A proper-noun person/body: two consecutive Capitalized words (e.g. "Barack Obama", "Supreme Court").
  const hasProperName = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(question);
  return hasYear && (hasNamedMeasure || hasProperName);
}

/** True when this generated question belongs to the Politics category (case-insensitive). */
export function isPoliticsCategory(category: string): boolean {
  return category.toLowerCase().includes("politic");
}

/** Has this batch aged out? */
export function batchIsStale(generatedAt: number, now: number): boolean {
  return now - generatedAt >= TRIVIA_REGEN_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}
