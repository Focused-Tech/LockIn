/**
 * AI probability calculator.
 *
 * In production this pulls from sports/financial/political data sources to
 * estimate outcome probabilities and set over/under lines; creators accept or
 * override. Until those integrations land, {@link suggestOddsMock} produces a
 * deterministic, plausible split so the slate builder is usable end-to-end.
 */
export interface OddsSuggestion {
  /** Probability option A occurs, 0–100. */
  probA: number;
  /** Probability option B occurs, 0–100. */
  probB: number;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Deterministic mock odds: a plausible 40–60 split derived from the question. */
export function suggestOddsMock(input: {
  question: string;
  optionA: string;
  optionB: string;
}): OddsSuggestion {
  const h = hashString(`${input.question}|${input.optionA}|${input.optionB}`);
  const probA = 40 + (h % 21); // 40..60
  return { probA, probB: 100 - probA };
}
