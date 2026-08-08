/**
 * CHAMPIONSHIP COPY-SLOT STORE — the single source for BOTH the rules-page sections AND the
 * Locksmith chip answers (an edit here lands in both places at once). Copy lives as DATA, exactly
 * like the tutorial copy store: prose is EMPTY until the architect approves it, and every empty slot
 * renders an honest "copy pending" placeholder — never invented copy, never an unset number.
 *
 * The chip QUESTIONS are architect-provided labels (from the slice spec), so they are present; the
 * chip ANSWERS are pending slots. When an answer slot is empty the Locksmith replies with a pending
 * line that points to the Championship page — she never states a value that isn't set.
 */

export const CHAMPIONSHIP_COPY_VERSION = "v1";

/** An ordered rules-page section. `copy` is empty until approved (placeholder renders instead). */
export interface ChampionshipSection {
  id: string;
  title: string;
  /** Approved prose — EMPTY until the architect's pass. */
  copy: string;
}

/** Section order is fixed by the spec (D). Titles are structural; prose is pending. */
export const CHAMPIONSHIP_SECTIONS: ChampionshipSection[] = [
  { id: "what", title: "What it is", copy: "" },
  { id: "divisions", title: "Divisions", copy: "" },
  { id: "qualifying", title: "Qualifying by win rate", copy: "" },
  { id: "seats", title: "Seats & the finale", copy: "" },
  { id: "prizes", title: "Prizes", copy: "" },
  { id: "free", title: "Free seats", copy: "" },
  { id: "rules", title: "Official rules", copy: "" },
];

/** A Locksmith dock chip. `q` is the tap label / sent question; `answer` is pending copy. */
export interface ChampionshipChip {
  id: string;
  q: string;
  /** Approved answer prose — EMPTY until the architect's pass. */
  answer: string;
  /** Creator-mode only (the creator playoffs chip). */
  creatorOnly?: boolean;
}

/** Chip set (spec G). Labels are given; answers are pending slots. */
export const CHAMPIONSHIP_CHIPS: ChampionshipChip[] = [
  { id: "what", q: "What's the Championship?", answer: "" },
  { id: "qualify", q: "How do I qualify?", answer: "" },
  { id: "win", q: "What can I win?", answer: "" },
  { id: "free_seat", q: "What's a free seat?", answer: "" },
  { id: "creator_playoffs", q: "What are the creator playoffs?", answer: "", creatorOnly: true },
];

/** Shown wherever an approved answer hasn't landed — no numbers, points at the rules page. */
export const CHAMPIONSHIP_PENDING_ANSWER =
  "The Championship details are being finalized. You can read the official rules on the Championship page.";

/** Placeholder body for an empty rules-page section. */
export const CHAMPIONSHIP_SECTION_PENDING = "Copy pending approval.";

/** The dock chips for a Locksmith mode. Championship is a cash surface, so it is hidden in the
 *  coins-only BEGINNER mode (two-currency rule); the creator-playoffs chip shows in creator only. */
export function championshipChipsForMode(mode: string): ChampionshipChip[] {
  if (mode === "beginner") return [];
  return CHAMPIONSHIP_CHIPS.filter((c) => !c.creatorOnly || mode === "creator");
}

/** The stored answer for a chip, or the pending line when the slot is empty. */
export function chipAnswer(chip: ChampionshipChip): string {
  return chip.answer.trim() ? chip.answer : CHAMPIONSHIP_PENDING_ANSWER;
}

/** Trigger-card copy slots (F). Title + body are PENDING until the architect's pass — no invented
 *  card copy; the card renders the pending placeholder and the "Championship" surface label. */
export interface ChampionshipCardCopy {
  id: string;
  title: string;
  body: string;
}
export const CHAMPIONSHIP_CARDS: Record<string, ChampionshipCardCopy> = {
  first_win: { id: "first_win", title: "", body: "" },
  division_change: { id: "division_change", title: "", body: "" },
  season_milestone: { id: "season_milestone", title: "", body: "" },
};
export const CHAMPIONSHIP_CARD_PENDING = "Copy pending approval.";
