import "server-only";
import { getAnthropic, AI_MODEL } from "./client";
import {
  buildPrompt,
  mapModelSlate,
  MAX_LEGS,
  MIN_LEGS,
  SLATE_TOOL,
  type GenerateSlateInput,
  type GeneratedSlate,
} from "./slatePrompt";

/**
 * AI SLATE ENGINE
 * ===============
 * Generates a ranked, difficulty-graded prediction slate for a topic using the
 * Anthropic model. Server-side only ("server-only" guard + needs ANTHROPIC_API_KEY).
 * The pure prompt/schema/mapping live in {@link ./slatePrompt}; this module adds
 * the key guard and the network call.
 *
 * ODDS FEED: the engine accepts an optional external odds feed keyed by leg
 * index. When the feed is UNSET it is LLM-only — the model estimates each
 * outcome probability itself. When a feed entry exists for a leg, its probA
 * overrides the model's estimate and the slate `source` is reported "llm+odds".
 */

export type {
  GenerateSlateInput,
  GeneratedSlate,
  GeneratedLeg,
  LegType,
  Difficulty,
  OddsFeedEntry,
} from "./slatePrompt";

/**
 * Generate a ranked slate for a topic. Throws on a missing API key or if the
 * model fails to return a valid tool call (the route maps these to HTTP errors).
 */
export async function generateSlate(
  input: GenerateSlateInput,
): Promise<GeneratedSlate> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  const legCount = Math.max(MIN_LEGS, Math.min(MAX_LEGS, input.legCount));

  const message = await getAnthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 2048,
    tools: [SLATE_TOOL],
    tool_choice: { type: "tool", name: SLATE_TOOL.name },
    messages: [{ role: "user", content: buildPrompt({ ...input, legCount }) }],
  });

  const toolBlock = message.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("AI_NO_TOOL_OUTPUT");
  }

  const slate = mapModelSlate(toolBlock.input, input, legCount);
  slate.model = AI_MODEL;
  return slate;
}
