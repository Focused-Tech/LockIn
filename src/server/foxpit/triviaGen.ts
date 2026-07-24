import "server-only";

/**
 * FOX PIT — trivia BATCH generation.
 *
 * Runs offline (scheduled, every TRIVIA_REGEN_INTERVAL_DAYS), never in a round.
 * One model call per (category × tier) cell; each returns TRIVIA_PER_CELL
 * known-answer questions about SETTLED past events.
 *
 * MODEL: claude-opus-4-8. This is a batch job — not latency-sensitive — and the
 * failure mode we care about is a wrong "fact" being baked in as truth, so this
 * path buys accuracy rather than speed. (CHAT_MODEL stays Haiku for the opposite
 * reason.)
 *
 * STRUCTURED OUTPUT: the installed SDK (0.32.1) predates `messages.parse()` /
 * `output_config`, so the schema is enforced by forcing a tool call and then
 * re-validating the tool input with zod. Upgrading the SDK would let this use
 * native structured outputs instead.
 */
import { getAnthropic } from "@/lib/ai/client";
import {
  TRIVIA_PER_CELL,
  TRIVIA_TIERS,
  TRIVIA_TARGET_ACCURACY,
  TRIVIA_TOOL_SCHEMA,
  generatedBatchSchema,
  politicalQuestionOk,
  isPoliticsCategory,
  type GeneratedQuestion,
} from "@/lib/foxpit/trivia";
import type { FoxPitRoomKey } from "@/lib/foxpit";

export const TRIVIA_MODEL = "claude-opus-4-8";

const TOOL_NAME = "emit_trivia";

function systemPrompt(): string {
  return [
    "You write trivia for a skill-based prediction game's PRACTICE mode.",
    "",
    "HARD RULES:",
    "1. Every question is about a SETTLED, ALREADY-DECIDED past event. Never about",
    "   anything upcoming, ongoing, scheduled, or otherwise undecided. If the answer",
    "   could still change, the question is invalid.",
    "2. The answer must be a matter of public record — checkable in seconds by anyone",
    "   who knows the category. No opinions, no 'best', no 'most memorable', no",
    "   predictions, no counterfactuals.",
    "3. Exactly one option is correct. The wrong options must be genuinely plausible to",
    "   someone who knows the category but doesn't know this specific fact.",
    "4. Do not reference 'this season', 'last year', 'currently', or any phrasing whose",
    "   truth depends on when it is read. Name the year explicitly instead.",
    "5. Prefer facts that have been settled for a while over very recent ones — a result",
    "   from several years ago cannot be overturned by news you have not seen.",
    "6. DIFFICULTY COMES FROM DECOY QUALITY, NOT OBSCURITY. A famous fact with three",
    "   genuinely plausible alternatives is harder than an obscure fact with one absurd",
    "   option. Write distractors a knowledgeable fan would actually have to think about —",
    "   real runners-up, near-miss figures, the other plausible year. Never pad with a joke",
    "   option or an obviously wrong one.",
    "7. CALIBRATE TO THE TARGET WIN RATE. Each cell states how often a typical player should",
    "   get it right. The PRACTICE floor (~70%) is a confidence builder: general-knowledge,",
    "   plainly-worded questions about the single most famous fact in the category — the",
    "   headline even a casual person has heard. Do NOT make the practice floor tricky; save",
    "   the hard, near-miss decoys for the upper floors. The point is for players to advance",
    "   and feel capable, not feel dumb and quit. Match the decoy strength to the target: easy",
    "   floors get one clearly-best answer; hard floors get four genuinely competing options.",
    "8. POLITICS (hard requirement): every political question MUST name the specifics — the",
    "   actual candidate or officeholder, the actual bill / law / measure by its real name,",
    "   the chamber or body, and the year. Vague framing is invalid.",
    "     REJECT: \"Did the Senate pass the infrastructure bill?\"",
    "     ACCEPT: \"In 2021, the Infrastructure Investment and Jobs Act passed the Senate by",
    "             what vote margin?\"",
    "",
    "Write questions a knowledgeable fan of the category would enjoy, not textbook",
    "filler. Vary what the question asks about; do not make every question 'who won'.",
  ].join("\n");
}

function userPrompt(category: string, tier: FoxPitRoomKey): string {
  const targetPct = Math.round(TRIVIA_TARGET_ACCURACY[tier] * 100);
  return [
    `Category: ${category}`,
    `Difficulty: ${TRIVIA_TIERS[tier]}`,
    `Target: about ${targetPct}% of typical players should answer correctly — tune the decoy strength to hit that rate.`,
    "",
    `Write ${TRIVIA_PER_CELL} questions at that difficulty, all in that category.`,
    "Every question must be independently answerable — no shared setup between them.",
  ].join("\n");
}

export interface GenerateCellResult {
  category: string;
  tier: FoxPitRoomKey;
  questions: GeneratedQuestion[];
}

/**
 * Generate one (category × tier) cell. Throws on an unusable response — the
 * caller decides whether to skip the cell or abort the batch. Never swallows.
 */
export async function generateTriviaCell(
  category: string,
  tier: FoxPitRoomKey,
): Promise<GenerateCellResult> {
  const res = await getAnthropic().messages.create({
    model: TRIVIA_MODEL,
    max_tokens: 8000,
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt(category, tier) }],
    tools: [
      {
        name: TOOL_NAME,
        description: "Return the generated trivia questions.",
        input_schema: TRIVIA_TOOL_SCHEMA,
      },
    ],
    // Force the tool so the reply is always the structured payload, never prose.
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    console.error("[trivia] no tool_use block", {
      category,
      tier,
      stopReason: res.stop_reason,
      blockTypes: res.content.map((b) => b.type),
    });
    throw new Error(`Trivia generation returned no tool call for ${category}/${tier}`);
  }

  const parsed = generatedBatchSchema.safeParse(block.input);
  if (!parsed.success) {
    console.error("[trivia] schema rejected the generated batch", {
      category,
      tier,
      issues: parsed.error.issues,
    });
    throw new Error(`Trivia generation failed validation for ${category}/${tier}`);
  }

  let questions = parsed.data.questions;

  // POLITICS validator (part 5): drop any political item lacking a named person/measure + a year,
  // rather than ship vague framing. Not silent — logs how many were dropped.
  if (isPoliticsCategory(category)) {
    const before = questions.length;
    questions = questions.filter((q) => politicalQuestionOk(q.question));
    if (questions.length < before) {
      console.error(
        `[trivia] dropped ${before - questions.length} vague political item(s) for ${category}/${tier} (need a named person/measure + a year)`,
      );
    }
  }

  return { category, tier, questions };
}
