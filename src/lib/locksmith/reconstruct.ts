import "server-only";

/**
 * LOCKSMITH RECONSTRUCTION (E) — a follower types a plain-language question idea; the Locksmith
 * rewrites it into a COMPLIANT proposal in the approved voice, mapped to the nearest approved
 * archetype. The creator decides — this only PROPOSES.
 *
 * Compliance is enforced in DEPTH, never trusted to the model:
 *   1. The model is told the archetypes + the hard rules + the voice, and returns a structured
 *      {compatible, archetype, question}.
 *   2. STRUCTURAL guards then run on the output: the archetype must be one of the approved six, the
 *      question must carry NO banned free-text (detectBannedArchetype), and entertainment questions
 *      must carry no number on an individual. Any failure ⇒ treated as INCOMPATIBLE — we return
 *      nothing rather than a broken approximation (E.b).
 *   3. A reconstructed question is a PROPOSAL, not an approved leg. It only becomes a leg when the
 *      creator authors it with subjects — where validateLeg runs as always (E.e). Nothing skips it.
 */
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/client";
import { APPROVED_ARCHETYPES } from "@/lib/contest/questionEngine";
import { ARCHETYPE_STEMS, ENTERTAINMENT_STEMS, type QuestionDomain } from "@/lib/contest/archetypeLibrary";
import { applyGuards, INCOMPATIBLE, type Reconstruction } from "./reconstructGuards";

export { applyGuards, type Reconstruction };

const RECONSTRUCT_TOOL = {
  name: "propose_question",
  description:
    "Rewrite a fan's raw question idea into ONE compliant Lock In contest question, mapped to the " +
    "nearest approved archetype and written in the approved conversational voice. If the idea cannot " +
    "be made compliant (it's about a single game/team outcome, a bet, or one person's number), set " +
    "compatible=false.",
  input_schema: {
    type: "object" as const,
    properties: {
      compatible: { type: "boolean", description: "true only if it can be made compliant" },
      archetype: { type: "string", enum: [...APPROVED_ARCHETYPES], description: "nearest approved archetype" },
      question: { type: "string", description: "the rewrite: one short line, approved voice, compares/counts across subjects" },
      reason: { type: "string", description: "if compatible=false, one short phrase why" },
    },
    required: ["compatible"],
  },
};

function promptFor(domain: QuestionDomain, rawText: string, category: string): string {
  const stems = domain === "entertainment" ? ENTERTAINMENT_STEMS : ARCHETYPE_STEMS;
  const voice = APPROVED_ARCHETYPES.map((a) => `  - ${a}: e.g. "${stems[a][0]}"`).join("\n");
  const domainRule =
    domain === "entertainment"
      ? "This is an ENTERTAINMENT show. Subjects are cast members / judges / hosts. NEVER put a number " +
        "on one person. Compare or COUNT across subjects (screen time, mentions, drama, camera time)."
      : "This is SPORTS. Subjects are players, one per game. Compare or count ACROSS different games.";
  return [
    `A fan suggested a question for a "${category}" contest. Rewrite it as ONE compliant Lock In question.`,
    "",
    "THE ONLY ALLOWED SHAPES (map to the nearest one):",
    voice,
    "",
    "HARD RULES (never break):",
    "  - Compares or counts across TWO OR MORE subjects — never a single subject's single event.",
    "  - One subject per game/episode unit.",
    "  - NO team or game outcomes (who wins, scores, spreads, over/unders, halftime).",
    "  - NO number attached to one individual (that's an over/under). Milestone COUNTS stay bucketed.",
    `  - ${domainRule}`,
    "",
    `Fan's idea: "${rawText}"`,
    "",
    "Call propose_question. Keep the question short and readable — the specificity comes from the show/league, not a long question.",
  ].join("\n");
}

/**
 * Reconstruct a follower suggestion. Returns INCOMPATIBLE (never a broken question) when the model is
 * unavailable, the mapping fails, or the output trips any structural guard.
 */
export async function reconstructSuggestion(input: { rawText: string; domain: QuestionDomain; category: string }): Promise<Reconstruction> {
  const rawText = input.rawText.trim();
  if (!rawText) return INCOMPATIBLE("empty");
  if (!process.env.ANTHROPIC_API_KEY) return INCOMPATIBLE("reconstruction unavailable");

  let out: { compatible?: boolean; archetype?: string; question?: string; reason?: string };
  try {
    const msg = await getAnthropic().messages.create({
      model: CHAT_MODEL,
      max_tokens: 400,
      tools: [RECONSTRUCT_TOOL],
      tool_choice: { type: "tool", name: RECONSTRUCT_TOOL.name },
      messages: [{ role: "user", content: promptFor(input.domain, rawText, input.category) }],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return INCOMPATIBLE("no proposal");
    out = block.input as typeof out;
  } catch {
    return INCOMPATIBLE("reconstruction error");
  }

  return applyGuards(out, input.domain);
}
