/**
 * SUBCATEGORY (B) — a subcategory is DATA, never a hardcoded show name in a component. A creator
 * SEARCHES for a show or league; a match resolves to one of these records, which carries everything
 * generation needs downstream:
 *   - `domain`  → which question VOICE fills the stems (sports box-score vs entertainment show nouns).
 *   - `stats`   → the stat VOCABULARY that fills {stat} (this is where the specificity lives — the
 *                 question stays readable, the subcategory carries the detail).
 *   - `subjectSource` → where the PLAYER POOL comes from: `espn_roster` (live, wired) for sports, or
 *                 `creator_cast` for entertainment (no cast API exists — the creator supplies the
 *                 cast; nothing is invented). See src/lib/contest/cast.ts.
 *
 * The seed index (seed.ts) is the STARTING set. The live index is the `subcategories` Firestore
 * collection (seeded from seed.ts). New shows are added as Firestore docs — extended WITHOUT a deploy.
 */
import type { QuestionDomain } from "@/lib/contest/archetypeLibrary";

export type { QuestionDomain };

export type SubcategoryKind =
  | "sports_league"
  | "reality_drama" // Housewives / Love & Hip Hop / Vanderpump / dating drama
  | "competition" // cooking / talent / design elimination shows
  | "custom"; // synthesized from a creator's free-typed show that isn't indexed yet

/** Where the subject (player/cast) pool is supplied from for this subcategory. */
export type SubjectSource = "espn_roster" | "creator_cast";

/** One stat in a subcategory's vocabulary. `boxLabel` + numeric bars are sports-only; entertainment
 *  stats are nouns with no number shown on an individual (buckets/races only). */
export interface SubStat {
  stat: string; // the noun that fills {stat} — "assists", "receiving yards", "screen time"
  boxLabel?: string; // sports box-score column (settlement); omit for entertainment
  milestone?: number; // sports milestone bar; omit for entertainment (no number on a subject)
  race?: number; // sports first-to bar; omit for entertainment
}

export interface Subcategory {
  slug: string; // stable id (kebab-case); the Firestore doc id
  name: string; // display name — "Basketball Wives", "NBA"
  category: string; // top-level CATEGORIES name this rolls up to ("NBA", "TV Shows", …)
  kind: SubcategoryKind;
  domain: QuestionDomain;
  aliases: string[]; // extra search terms (nicknames, franchise words)
  stats: SubStat[];
  subjectSource: SubjectSource;
  /** sports_league → the ESPN league key (H2H_CONFIG). Absent for entertainment. */
  espnLeague?: string;
  /** provenance so the index can be audited/extended — e.g. "All Reality" for reality-TV seeds. */
  source?: string;
}
