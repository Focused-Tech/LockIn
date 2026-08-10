/**
 * Deterministic abuse patterns (Part 3) — pure, no server deps, so it's unit-testable and shared by
 * the creator-content moderator. Catches the unambiguous stuff with no model spend; the semantic
 * categories (defamation of a real person, doxxing judgement, impersonation) are left to the classifier.
 */
export type ModerationCategory =
  | "hate"
  | "harassment"
  | "sexual"
  | "violence"
  | "self_harm"
  | "defamation"
  | "doxxing"
  | "impersonation";

const SLURS = [
  /\bn[i1]gg(?:er|a)s?\b/i,
  /\bf[a4]gg?(?:ot)?s?\b/i,
  /\bk[i1]kes?\b/i,
  /\bch[i1]nks?\b/i,
  /\bsp[i1]cs?\b/i,
  /\btr[a4]nn(?:y|ie)s?\b/i,
  /\bret[a4]rds?\b/i,
];
const SEXUAL = [/\b(?:porn|pornographic|nsfw)\b/i, /\bsexual(?:ly)?\s+explicit\b/i, /\berotic(?:a)?\b/i];
const VIOLENCE = [
  /\b(?:kill|murder|shoot|stab|lynch|behead)\s+(?:you|him|her|them|that\s+\w+)\b/i,
  /\bi'?ll\s+(?:kill|hurt|beat|end)\s+you\b/i,
  /\bdeath\s+to\b/i,
];
const SELF_HARM = [/\b(?:commit\s+)?suicide\b/i, /\bkill\s+(?:myself|yourself)\b/i, /\bself[-\s]?harm\b/i];
const HARASSMENT = [/\byou(?:'re| are)\s+(?:a\s+)?(?:worthless|pathetic|disgusting)\b/i];
const DOXXING = [
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, // SSN-shaped
  /\b\d{1,5}\s+\w+(?:\s+\w+){0,3}\s+(?:st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i, // street address
  /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone
];

const DETERMINISTIC: [ModerationCategory, RegExp[]][] = [
  ["hate", SLURS],
  ["self_harm", SELF_HARM],
  ["violence", VIOLENCE],
  ["harassment", HARASSMENT],
  ["sexual", SEXUAL],
  ["doxxing", DOXXING],
];

/** First deterministic abuse category in `text`, or null. */
export function deterministicModerationCategory(text: string): ModerationCategory | null {
  const t = text ?? "";
  for (const [category, patterns] of DETERMINISTIC) {
    if (patterns.some((re) => re.test(t))) return category;
  }
  return null;
}

export const MODERATION_HUMAN: Record<ModerationCategory, string> = {
  hate: "a slur or hate speech",
  harassment: "harassment",
  sexual: "sexual content",
  violence: "a threat or violent content",
  self_harm: "self-harm content",
  defamation: "a degrading claim about a real person",
  doxxing: "someone's private personal information",
  impersonation: "impersonation of a real person or brand",
};
