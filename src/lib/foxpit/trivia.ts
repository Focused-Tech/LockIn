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
 * obscure fact with one absurd option.
 *
 * The PRACTICE floor (dojo) is deliberately a confidence builder: GENERAL-KNOWLEDGE, plainly
 * worded questions a typical player gets right ~70% of the time — even someone who follows the
 * category only casually. Players should ADVANCE and feel capable, not feel dumb and quit. Each
 * floor up tightens the decoys and the specificity so the climb is genuinely felt. The label is
 * handed to the generator verbatim.
 */
export const TRIVIA_TIERS: Record<FoxPitRoomKey, string> = {
  dojo: "PRACTICE FLOOR — general knowledge, easy. Ask the single most famous, widely-known fact in the category (the headline even a casual person has heard). Plain wording, zero jargon, 2 options where the correct one clearly stands out to anyone who follows the category at all. A typical player should get about 70% of these right — do NOT make this floor tricky.",
  coliseum: "3 options, one genuinely plausible decoy a casual fan might fall for. Still a well-known fact — about 55% of players get it.",
  hightable: "4 options, specifics — exact years, margins, chart positions, runners-up; all four options are plausible to a fan. About 40% get it.",
  suite: "4 options, expert tier — precise figures and second-order details; distractors are near-misses only an expert rules out. About 28% get it.",
};

/**
 * Target share of typical players who should answer correctly, per floor. The practice floor is a
 * confidence builder (~70%); each floor up is harder. Folded into the generator prompt so the model
 * calibrates decoy strength to the intended win rate — the goal is players advancing, not quitting.
 */
export const TRIVIA_TARGET_ACCURACY: Record<FoxPitRoomKey, number> = {
  dojo: 0.7,
  coliseum: 0.55,
  hightable: 0.4,
  suite: 0.28,
};

/** The categories the pool is generated for — the SAME set the player picks from. */
export const TRIVIA_CATEGORIES = CATEGORIES.map((c) => c.name);

/**
 * FOX PIT TRIVIA TAXONOMY (section 3c) — the approved generation breadth: parent → subcategories.
 * Every batch spreads across ALL of it, and each (subcategory × tier) is its OWN pool with its own
 * low-water mark. Many facts per subcategory × three tiers per fact family = effectively unlimited
 * supply; difficulty is carried by DECOY QUALITY, never obscurity.
 */
export const FOXPIT_TRIVIA_TAXONOMY: Record<string, string[]> = {
  "Reality Competition": [
    "Survivor", "Big Brother", "The Challenge", "Love Island", "Bachelor Nation",
    "90 Day Fiance", "Drag Race", "Hell's Kitchen", "MasterChef", "Top Chef", "Next Level Chef",
  ],
  Sitcoms: ["90s Black sitcoms", "Friends/Seinfeld era", "Office/mockumentary", "Abbott/current"],
  Drama: ["Power universe", "prestige cable", "current streaming originals"],
  "Game Shows": ["Price Is Right", "Feud", "Wheel/game-show history", "Deal or No Deal"],
  Sports: ["NBA", "NFL", "boxing/UFC", "college hoops", "big televised moments"],
  Music: ["hip-hop/R&B", "videos & VMAs", "Verzuz", "halftime shows"],
  "News/Politics": ["named person + measure + year"],
  Awards: ["Emmys", "BET", "Oscars"],
  Movies: ["franchises", "Black cinema", "box office"],
  "TV Mechanics": ["finales", "catchphrases", "theme songs", "spin-offs"],
};

/** Flattened generation cells — one "Parent · Subcategory" label per subcategory. */
export const FOXPIT_TRIVIA_SUBCATEGORIES: { parent: string; sub: string; label: string }[] =
  Object.entries(FOXPIT_TRIVIA_TAXONOMY).flatMap(([parent, subs]) =>
    subs.map((sub) => ({ parent, sub, label: `${parent} · ${sub}` })),
  );

/**
 * UNIQUENESS AT GENERATION (section 3b). A normalized STEM = the question with case, punctuation,
 * filler words and year/number specifics stripped — so two phrasings of the SAME fact collide. The
 * same fact MAY return at a HIGHER tier (harder decoys) — that is a new question — so the dedup key
 * is (stemHash + tier), never the stem alone.
 */
export function normalizeStem(question: string): string {
  return question
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "#") // collapse specific years so "in 2019" ~ "in 2021"
    .replace(/\b\d+(\.\d+)?\b/g, "#") // collapse numbers/margins
    .replace(/[^a-z#\s]/g, " ") // drop punctuation
    .replace(/\b(the|a|an|of|in|on|at|to|for|by|what|which|who|whom|was|were|did|does|is|are|how|many|much)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap stable 32-bit hash of the normalized stem (djb2). Collisions are acceptable — this is a
 *  dedup heuristic, not a security boundary. */
export function stemHash(question: string): string {
  const s = normalizeStem(question);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The dedup key for a question: same fact at the same TIER phrased twice is a duplicate; the same
 *  fact at a higher tier is a new, harder question. */
export function questionDedupeKey(tier: FoxPitRoomKey, question: string): string {
  return `${tier}:${stemHash(question)}`;
}

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
