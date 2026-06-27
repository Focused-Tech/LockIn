import { z } from "zod";

/**
 * PURE core of the AI slate engine: types, the Anthropic tool schema, the prompt
 * builder, and the model-output → slate mapper. No "server-only", no SDK — so it
 * can be imported by the engine ({@link ./aiEngine}) and exercised directly in
 * tests/scripts. The engine adds only the API key guard + the network call.
 */

export type LegType = "binary" | "over_under";
export type Difficulty = "easy" | "medium" | "hard";

export interface GeneratedLeg {
  /** 1-based rank, strongest favorite first. */
  rank: number;
  question: string;
  type: LegType;
  optionA: string;
  optionB: string;
  /** The numeric line for an over_under leg; null for binary. */
  overUnderLine: number | null;
  /** Probability option A occurs, 0–100 (probB = 100 − probA). */
  probA: number;
  probB: number;
  difficulty: Difficulty;
  /** One-line grounding for the estimate (shown to the creator, not players). */
  rationale: string;
}

export interface GeneratedSlate {
  topic: string;
  category: string;
  legs: GeneratedLeg[];
  /** "llm" when LLM-only; "llm+odds" when an odds feed anchored ≥1 leg. */
  source: "llm" | "llm+odds";
  model: string;
}

export interface OddsFeedEntry {
  probA: number;
}

export interface GenerateSlateInput {
  topic: string;
  legCount: number;
  /**
   * Optional external odds feed, keyed by 0-based leg index. Unset → LLM-only.
   * Present entries override the model's probA for that leg.
   */
  oddsFeed?: Record<number, OddsFeedEntry>;
}

export const MIN_LEGS = 1;
export const MAX_LEGS = 10;

/** Schema the model's tool call is validated against before we trust it. */
export const modelLegSchema = z.object({
  question: z.string().min(3),
  type: z.enum(["binary", "over_under"]),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  overUnderLine: z.number().nullable().optional(),
  probA: z.number(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  rationale: z.string().default(""),
});
export const modelSlateSchema = z.object({
  category: z.string().min(1),
  legs: z.array(modelLegSchema).min(1),
});

/** Anthropic tool input schema (JSON Schema) mirroring {@link modelSlateSchema}. */
export const SLATE_TOOL = {
  name: "emit_slate",
  description:
    "Return the generated prediction slate as structured data. Call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description:
          "Single best-fit category, e.g. NBA, NFL, Soccer, Crypto, Politics.",
      },
      legs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string", description: "The prediction question." },
            type: {
              type: "string",
              enum: ["binary", "over_under"],
              description:
                "binary = yes/no or A-vs-B; over_under = a numeric line.",
            },
            optionA: { type: "string", description: 'For over_under use "Over".' },
            optionB: { type: "string", description: 'For over_under use "Under".' },
            overUnderLine: {
              type: ["number", "null"],
              description: "The numeric line for over_under; null for binary.",
            },
            probA: {
              type: "number",
              description: "Probability (0–100) that option A occurs.",
            },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description:
                "easy = strong favorite, medium = lean, hard = near coin-flip.",
            },
            rationale: {
              type: "string",
              description: "One short line grounding the estimate.",
            },
          },
          required: [
            "question",
            "type",
            "optionA",
            "optionB",
            "probA",
            "difficulty",
          ],
        },
      },
    },
    required: ["category", "legs"],
  },
};

export const clampProb = (p: number): number =>
  Math.max(1, Math.min(99, Math.round(p)));

/** Normalize difficulty from the favorite's strength (spread off 50/50). */
export function difficultyFromProb(probA: number): Difficulty {
  const favorite = Math.max(probA, 100 - probA);
  if (favorite >= 67) return "easy";
  if (favorite >= 57) return "medium";
  return "hard";
}

export function buildPrompt(input: GenerateSlateInput): string {
  return [
    `Build a prediction-contest slate of exactly ${input.legCount} legs for this topic:`,
    `"${input.topic}".`,
    "",
    "Requirements:",
    "- Each leg is a concrete, verifiable prediction about a real upcoming outcome.",
    "- Include a MIX of leg types: mostly binary (A vs B / yes-no) plus at least",
    "  one or two over_under legs with a sensible numeric line (e.g. total points,",
    '  player stat). For over_under, optionA="Over", optionB="Under".',
    "- Estimate probA (probability option A occurs) as a calibrated 0–100 number.",
    "- Set difficulty: easy = strong favorite, medium = lean, hard = near coin-flip.",
    "- Vary the difficulty across legs; do not make them all coin-flips.",
    "- Keep questions short and unambiguous.",
    "",
    "Call the emit_slate tool exactly once with the result.",
  ].join("\n");
}

/**
 * Map a validated tool payload to the ranked, normalized slate. Pure: applies
 * the optional odds feed, clamps probabilities, derives probB + difficulty, and
 * ranks legs by confidence (strongest favorite = rank 1).
 */
export function mapModelSlate(
  toolInput: unknown,
  input: GenerateSlateInput,
  legCount: number,
): GeneratedSlate {
  const parsed = modelSlateSchema.parse(toolInput);

  let usedFeed = false;
  const legs: GeneratedLeg[] = parsed.legs.slice(0, legCount).map((leg, i) => {
    const feed = input.oddsFeed?.[i];
    let probA = clampProb(leg.probA);
    if (feed && typeof feed.probA === "number") {
      probA = clampProb(feed.probA);
      usedFeed = true;
    }
    const isOU = leg.type === "over_under";
    return {
      rank: 0, // assigned after sorting
      question: leg.question.trim(),
      type: leg.type,
      optionA: isOU ? "Over" : leg.optionA.trim(),
      optionB: isOU ? "Under" : leg.optionB.trim(),
      overUnderLine: isOU ? (leg.overUnderLine ?? null) : null,
      probA,
      probB: 100 - probA,
      difficulty: difficultyFromProb(probA),
      rationale: (leg.rationale ?? "").trim(),
    };
  });

  // Rank by confidence: the strongest favorite (largest spread off 50%) first.
  legs.sort(
    (a, b) =>
      Math.max(b.probA, b.probB) - Math.max(a.probA, a.probB) ||
      a.question.localeCompare(b.question),
  );
  legs.forEach((leg, i) => (leg.rank = i + 1));

  return {
    topic: input.topic,
    category: parsed.category.trim(),
    legs,
    source: usedFeed ? "llm+odds" : "llm",
    model: "", // filled in by the engine (which owns the model id)
  };
}
