/**
 * RECONSTRUCTION GUARDS (E) — pure, no I/O, no server-only, so they're unit-tested independently of
 * the model. Compliance is NEVER trusted to the LLM: a reconstructed proposal must be an approved
 * archetype, carry no banned free-text, and (for entertainment) put no number on an individual. Any
 * failure ⇒ incompatible — the caller returns nothing, never a broken approximation.
 */
import { APPROVED_ARCHETYPES, detectBannedArchetype, type Archetype } from "@/lib/contest/questionEngine";
import type { QuestionDomain } from "@/lib/contest/archetypeLibrary";

export interface Reconstruction {
  compatible: boolean;
  archetype: Archetype | null;
  /** the compliant rewrite, in the approved voice; null when not compatible. */
  question: string | null;
  /** internal note (why it couldn't be reconstructed) — never shown to the follower verbatim. */
  reason: string | null;
}

export const INCOMPATIBLE = (reason: string): Reconstruction => ({ compatible: false, archetype: null, question: null, reason });

/** Structural guards on a model proposal. */
export function applyGuards(out: { compatible?: boolean; archetype?: string; question?: string; reason?: string }, domain: QuestionDomain): Reconstruction {
  if (!out.compatible) return INCOMPATIBLE(out.reason || "not compatible");
  const archetype = out.archetype as Archetype | undefined;
  const question = (out.question ?? "").trim();
  if (!archetype || !APPROVED_ARCHETYPES.includes(archetype)) return INCOMPATIBLE("bad archetype");
  if (question.length < 6) return INCOMPATIBLE("empty question");
  if (detectBannedArchetype(question, []) !== null) return INCOMPATIBLE("banned text");
  if (domain === "entertainment" && /\d/.test(question)) return INCOMPATIBLE("number on a subject");
  return { compatible: true, archetype, question, reason: null };
}
