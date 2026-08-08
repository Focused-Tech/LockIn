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
  /** Ships in place but flagged pending counsel review (the official-rules block). */
  pendingReview?: boolean;
}

/**
 * Section order fixed by the spec (D). Copy is APPROVED and published VERBATIM from
 * CHAMPIONSHIP_RULES_COPY_v1_2026-08-08.md. [ARCHITECT] items were replaced by their approved
 * "details announced" line; the official-rules block ships in place, flagged pending counsel review
 * (see `pendingReview`).
 */
export const CHAMPIONSHIP_SECTIONS: ChampionshipSection[] = [
  {
    id: "what",
    title: "What it is",
    copy:
      "**One season. One seat. One champion per division.**\n\n" +
      "The Championship is LockIn's biggest stage. All year, every slate you win builds your record. Play well enough, long enough, and you earn a seat at the finale — where Boss Fox himself sets the final slate and the best player in each division takes the crown.\n\n" +
      "You can't buy your way in. Seats are earned by skill, all season long.",
  },
  {
    id: "divisions",
    title: "Divisions",
    copy:
      "**Four divisions. Pick your level.**\n\n" +
      "Divisions are set by entry stake: **$5 · $10 · $25 · $50.** Each division runs its own season and crowns its own champion. Your record lives in the division you play — win where you play, rise where you win.",
  },
  {
    id: "qualifying",
    title: "Qualifying by win rate",
    copy:
      "**Your win rate is your ticket.**\n\n" +
      "Every settled slate counts toward your season win rate. The players with the strongest records in each division qualify for that division's finale. There is no qualifying fee and no shortcut — the seat is earned, never sold.\n\n" +
      "When more players qualify than there are seats, **lock-in speed breaks the tie**: the earlier you've locked your winning cards all season, the higher you're seeded. Speed matters here the way it matters everywhere on LockIn — being right is the entry, being fast is the edge.\n\n" +
      "Your standing lives on your Board: your division, your win rate, and where you sit against the line.",
  },
  {
    id: "seats",
    title: "Seats & the finale",
    copy:
      "**The finale: six legs, set by Boss Fox.**\n\n" +
      "Boss Fox is the house creator, and the finale slate is his. Six legs. Answer all six correctly for a perfect card. Among perfect cards, lock-in speed ranks the top five — the fastest perfect card is the champion.\n\n" +
      "Finale entry for qualified players: your division's stake plus the Boss's creator fee (the $50 division is $50 + $5 = $55).\n\n" +
      "Details announced before the season finale.",
  },
  {
    id: "prizes",
    title: "Prizes",
    copy:
      "**The champion's share.**\n\n" +
      "Every division's finale pays its top five from that division's prize pool:\n\n" +
      "| Place | Share of the division pool |\n|---|---|\n| **Champion** | **20%** |\n| 2nd | 1% |\n| 3rd | 0.5% |\n| 4th | 0.25% |\n| 5th | 0.25% |\n\n" +
      "The bigger the division, the bigger the crown. At a full field, the $50 division's champion prize is **$10,000,000** — with $5, $10, and $25 division crowns scaling to their own fields. Prize pools are stated at each finale; the flagship finale's champion prize is guaranteed when announced as guaranteed, and every other division pays exactly its stated share of its actual pool.",
  },
  {
    id: "free",
    title: "Free seats",
    copy:
      "**10,000 free seats. Zero dollars in.**\n\n" +
      "Every season, 10,000 finale seats are completely free — no entry stake, no creator fee. Free seats sit **on top of** the paid field, and a free-seat winner is paid from the same prize table as everyone else. Nothing into it; up to the champion's crown out of it.\n\n" +
      "Free-seat details posted at season open.",
  },
  {
    id: "rules",
    title: "Official rules",
    pendingReview: true,
    copy:
      "**The fine print that isn't small.**\n\n" +
      "- The LockIn Championship is a **skill-based contest**. Outcomes are determined by players' knowledge, judgment, and lock-in speed.\n" +
      "- Open to eligible players **18+** (21+ where required by law), physically located in eligible states/regions at time of entry. Eligibility is verified; play where it's legal, coins-only everywhere else.\n" +
      "- **Apple and Google are not sponsors** of, and are not involved in, this contest in any way.\n" +
      "- Full official rules, eligibility terms, and the free-entry method are published here and in the Contest Rules accepted at signup.",
  },
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

/** Chip set (spec G). Answers are APPROVED, published VERBATIM (same source as the rules page). */
export const CHAMPIONSHIP_CHIPS: ChampionshipChip[] = [
  {
    id: "what",
    q: "What's the Championship?",
    answer:
      "The big one. Four divisions, one season, one champion each. Every slate you win all year builds your record — the best records earn a seat at Boss Fox's finale. Your standing's on your Board.",
  },
  {
    id: "qualify",
    q: "How do I qualify?",
    answer:
      "Win. Your season win rate in your division is the whole ticket — no fee, no invite, no shortcut. If it comes down to a tiebreak, the player who locked in faster takes the seat.",
  },
  {
    id: "win",
    q: "What can I win?",
    answer:
      "The champion takes 20% of the division's prize pool — at a full field in the $50 division, that's a $10,000,000 crown. Places two through five are paid too. The bigger your division's field, the bigger the prize.",
  },
  {
    id: "free_seat",
    q: "What's a free seat?",
    answer:
      "Ten thousand finale seats every season cost exactly nothing — no stake, no fee — and pay from the same prize table. Details post at season open. Nothing in, champion's crown out.",
  },
  {
    id: "creator_playoffs",
    q: "What are the creator playoffs?",
    creatorOnly: true,
    answer:
      "That's the creators' own prize track — creators are ranked by how many players their events draw, with quarterly playoffs and a season final. Different ladder than the player Championship; your followers chase theirs, you chase yours.",
  },
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
