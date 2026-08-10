import "server-only";
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/client";
import {
  deterministicModerationCategory,
  MODERATION_HUMAN as HUMAN,
  type ModerationCategory,
} from "./patterns";

/**
 * CREATOR-CONTENT ABUSE MODERATION (Part 3).
 *
 * This is NOT the compliance-shape check. `validateLeg` / `firstBannedLeg` decide whether a question
 * is an allowed CONTEST SHAPE (two names from two games, no game outcomes). A leg can be perfectly
 * shaped and still say something vile — that's what this catches. Both must pass; shape runs first,
 * this runs second (see the publish actions), and either failure hard-blocks the publish.
 *
 * Refuses: slurs / hate speech, harassment, sexual content, violence or threats, self-harm content,
 * defamatory or degrading claims about a NAMED real person, doxxing, impersonation. On a hit it NAMES
 * the field and the category (red-leg pattern) — it NEVER silently rewrites the creator's words.
 *
 * Two layers, cheapest-first:
 *   1. deterministic scan — free, catches the unambiguous stuff with no model spend.
 *   2. one Haiku classification call — only if layer 1 is clean — for the semantic categories
 *      (defamation of a real person, doxxing, impersonation) a regex can't judge.
 * Layer 2 fails OPEN (layer 1 still enforced) if the key is missing or the call errors, so an API
 * blip can't wedge every publish.
 */

export type { ModerationCategory };

export interface ModerationField {
  /** Player-facing name of the field, e.g. "Leg 2 question", "Option A", "Title". */
  label: string;
  value: string;
}

export interface ModerationFailure {
  field: string;
  category: ModerationCategory;
  /** Creator-facing, names the fix. Mirrors LegVerdict.message. */
  message: string;
}

export interface ModerationResult {
  ok: boolean;
  failures: ModerationFailure[];
}

const fix = (label: string, cat: ModerationCategory): string =>
  `${label} contains ${HUMAN[cat]}. Rewrite it to publish.`;

// ── Layer 2: Haiku classifier (semantic categories) ────────────────────────────
const CLASSIFY_TOOL = {
  name: "report_violations",
  description:
    "Report any field that contains abusive content a moderator would reject: hate/slurs, harassment, " +
    "sexual content, violence/threats, self-harm, a degrading or defamatory claim about a NAMED real " +
    "person, doxxing (someone's private info), or impersonation of a real person/brand. Ordinary sports/pop-" +
    "culture comparisons between public figures are FINE — only flag genuine abuse.",
  input_schema: {
    type: "object" as const,
    properties: {
      violations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "the exact field label given" },
            category: {
              type: "string",
              enum: ["hate", "harassment", "sexual", "violence", "self_harm", "defamation", "doxxing", "impersonation"],
            },
          },
          required: ["label", "category"],
        },
      },
    },
    required: ["violations"],
  },
};

async function classifyFields(fields: ModerationField[]): Promise<ModerationFailure[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []; // fail open — layer 1 still enforced
  const numbered = fields.map((f) => `[${f.label}]: ${f.value}`).join("\n");
  const msg = await getAnthropic().messages.create({
    model: CHAT_MODEL, // cheapest model — this is classification, not reasoning
    max_tokens: 512,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
    messages: [
      {
        role: "user",
        content:
          "Moderate these creator-authored contest fields. Flag only genuine abuse; sports/pop-culture " +
          "comparisons between public figures are allowed.\n\n" +
          numbered,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];
  const raw = (block.input as { violations?: { label: string; category: string }[] }).violations ?? [];
  const valid = new Set<string>(Object.keys(HUMAN));
  const byLabel = new Map(fields.map((f) => [f.label, f]));
  const out: ModerationFailure[] = [];
  for (const v of raw) {
    if (!byLabel.has(v.label) || !valid.has(v.category)) continue;
    const category = v.category as ModerationCategory;
    out.push({ field: v.label, category, message: fix(v.label, category) });
  }
  return out;
}

/**
 * Moderate a set of creator free-text fields. Layer 1 (deterministic) runs first and short-circuits
 * with NO model spend on a clear hit; only clean input reaches the one Haiku call. Returns every
 * failure (field + category + fix) so the creator sees exactly what to change — never a rewrite.
 */
export async function moderateCreatorFields(fields: ModerationField[]): Promise<ModerationResult> {
  const nonEmpty = fields.filter((f) => f.value && f.value.trim().length > 0);
  const failures: ModerationFailure[] = [];
  for (const f of nonEmpty) {
    const cat = deterministicModerationCategory(f.value);
    if (cat) failures.push({ field: f.label, category: cat, message: fix(f.label, cat) });
  }
  if (failures.length > 0) return { ok: false, failures }; // clear abuse → block, no model call

  try {
    failures.push(...(await classifyFields(nonEmpty)));
  } catch {
    /* classifier failed — layer 1 already passed; fail open rather than wedge every publish */
  }
  return { ok: failures.length === 0, failures };
}

/** One-line creator-facing summary of the first failure, for a `{ ok:false, error }` action return. */
export function firstModerationError(result: ModerationResult): string | null {
  return result.failures[0]?.message ?? null;
}
