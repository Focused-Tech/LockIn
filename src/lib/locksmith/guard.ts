/**
 * LOCKSMITH GUARD (Part 2) — a deterministic content gate that wraps the AI chat on BOTH sides.
 *
 * The system prompt is the primary guard (it constrains the model). This is the ENFORCED backstop:
 * the model can't be trusted to always comply, so nothing she is fed (input) or would emit (output)
 * ships to the player without passing here first. A hit returns the fallback — never a partial, never
 * a category name to the player. The blocked text + reason are recorded server-side for review.
 *
 * Categories she must never produce (and prompts trying to elicit them):
 *   sexual · harassment/slurs · self-harm · illegal-activity instructions ·
 *   medical/legal/financial advice · claims about specific real people ·
 *   Lock In's rake or any house margin · any architect value that is unset.
 *
 * Detection is pattern-based (fast, no model call — this is a high-volume chat). It is intentionally
 * conservative: it catches the deterministic, high-risk leaks. Semantic categories (real-people
 * claims, advice) are caught by their strongest surface markers; the model prompt covers the rest.
 */

export type GuardCategory =
  | "sexual"
  | "harassment"
  | "self_harm"
  | "illegal"
  | "advice"
  | "real_person"
  | "house_margin"
  | "unset_value";

export interface GuardVerdict {
  /** True → block and serve the RESTRICTED fallback. */
  blocked: boolean;
  /** For the server-side record only. NEVER surfaced to the player. */
  category: GuardCategory | null;
}

/**
 * House economics she must never reveal — "rake" and any framing of Lock In taking a margin.
 * (The word "rake" is banned in her copy anyway; this makes it an enforced block, not a request.)
 */
const HOUSE_MARGIN = [
  /\brake\b/i,
  /house(?:'?s)?\s+(?:cut|take|edge|margin|profit|fee)\b/i,
  /\b(?:the\s+)?house\s+(?:makes|takes|keeps|earns)\b/i,
  /how much (?:does )?lock\s?in (?:make|take|keep|earn|profit)/i,
];

/** Self-harm — block on either side (she must never produce it; a prompt seeking it is recorded). */
const SELF_HARM = [
  /\b(?:kill|hurt|harm|cut|hang)\s+(?:myself|yourself|himself|herself|themselves)\b/i,
  /\b(?:commit\s+)?suicide\b/i,
  /\bend(?:ing)?\s+(?:my|your|his|her|their)\s+life\b/i,
  /\bself[-\s]?harm\b/i,
  /\bwant(?:s|ed)?\s+to\s+die\b/i,
];

/** Illegal-activity instructions. Coarse, high-confidence markers only. */
const ILLEGAL = [
  /how\s+to\s+(?:make|build|synthesi[sz]e|cook)\s+(?:a\s+)?(?:bomb|meth|napalm|explosive|silencer)/i,
  /\blaunder(?:ing)?\s+money\b/i,
  /\bbuy\s+(?:illegal\s+)?(?:drugs|cocaine|heroin|fentanyl|a\s+gun\s+illegally)\b/i,
  /\bcounterfeit\s+(?:money|cash|bills)\b/i,
  /how\s+to\s+(?:hack|steal|defraud|evade\s+taxes)/i,
];

/** Sexual content markers. */
const SEXUAL = [
  /\b(?:porn|pornographic|nsfw)\b/i,
  /\bsexual(?:ly)?\s+explicit\b/i,
  /\bexplicit\s+sexual\b/i,
  /\berotic(?:a)?\b/i,
  /\bnude\s+(?:photo|pic|image)/i,
];

/** Slurs — a minimal, unambiguous hate-slur set (lowercased, word-boundaried). Extend as needed. */
const SLURS = [
  /\bn[i1]gg(?:er|a)s?\b/i,
  /\bf[a4]gg?(?:ot)?s?\b/i,
  /\bk[i1]kes?\b/i,
  /\bch[i1]nks?\b/i,
  /\bsp[i1]cs?\b/i,
  /\btr[a4]nn(?:y|ie)s?\b/i,
  /\bret[a4]rds?\b/i,
];

/** Medical / legal / financial advice — she is a game guide, not an advisor. Directive markers. */
const ADVICE = [
  /\b(?:medical|legal|tax|investment|financial)\s+advice\b/i,
  /\byou\s+should\s+(?:invest|sue|see\s+a\s+doctor|take\s+(?:this|these)\s+(?:medication|pills?|drugs?))\b/i,
  /\b(?:diagnos|prescrib)(?:e|es|ing|is)\b/i,
  /\bis\s+this\s+(?:a\s+)?good\s+investment\b/i,
];

/** Claims about specific real people — coarse marker: naming a public figure + a factual assertion. */
const REAL_PERSON = [
  /\b(?:is|was|are|has|did)\s+(?:donald\s+trump|joe\s+biden|elon\s+musk|taylor\s+swift|lebron\s+james)\b/i,
];

/**
 * Architect values that are UNSET — she must never invent a number for them. Detect the metric's
 * name appearing near a digit. Kept in sync with the still-`null` fields of architectSet.ts.
 */
const UNSET_VALUE = [
  /\bqualif(?:y|ication|ies)\b[^.?!]{0,50}\d/i,
  /\bchampionship\s+(?:season\s+)?milestone\b[^.?!]{0,50}\d/i,
  /\bkeyholder\s+(?:trigger|band|cap|rate)\b[^.?!]{0,50}\d/i,
  /\bkeymaster\s+(?:cap|rate|override)\b[^.?!]{0,50}\d/i,
  /\bfield\s+(?:pct|percent|%)\s+paid\b[^.?!]{0,50}\d/i,
];

const CATEGORIES: [GuardCategory, RegExp[]][] = [
  ["self_harm", SELF_HARM],
  ["house_margin", HOUSE_MARGIN],
  ["illegal", ILLEGAL],
  ["sexual", SEXUAL],
  ["harassment", SLURS],
  ["advice", ADVICE],
  ["real_person", REAL_PERSON],
  ["unset_value", UNSET_VALUE],
];

/**
 * Evaluate a single piece of text (a user message OR a model reply). Returns the FIRST category that
 * matches, or `{ blocked:false }`. Used identically for the input guard and the output guard so the
 * two sides can never disagree.
 */
export function evaluateLocksmithText(text: string): GuardVerdict {
  const t = text ?? "";
  for (const [category, patterns] of CATEGORIES) {
    if (patterns.some((re) => re.test(t))) return { blocked: true, category };
  }
  return { blocked: false, category: null };
}
