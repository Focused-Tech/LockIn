/**
 * SUBCATEGORY SEARCH (B) — pure, no I/O. A creator TYPES a show or league; this ranks the index and,
 * when nothing matches, SYNTHESIZES a reasonable subcategory from the typed text so a show that isn't
 * indexed yet still resolves (never a dead end). The server action feeds this the merged index
 * (Firestore over seed) so Firestore-added shows are searchable with no deploy.
 */
import type { Subcategory } from "./types";
import { slugify, DEFAULT_ENTERTAINMENT_STATS } from "./seed";

const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

/** Rank: exact name > name starts-with > alias starts-with > name/alias contains > token overlap. */
function score(sub: Subcategory, q: string): number {
  const name = norm(sub.name);
  const aliases = sub.aliases.map(norm);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (aliases.some((a) => a === q)) return 78;
  if (aliases.some((a) => a.startsWith(q))) return 65;
  if (name.includes(q)) return 55;
  if (aliases.some((a) => a.includes(q))) return 45;
  // token overlap (every query word appears somewhere in name+aliases)
  const hay = [name, ...aliases].join(" ");
  const words = q.split(" ").filter(Boolean);
  if (words.length && words.every((w) => hay.includes(w))) return 30;
  return 0;
}

/** Ranked matches for a query, best first. Empty query → the leading slice of the index. */
export function searchSubcategories(query: string, index: Subcategory[], limit = 8): Subcategory[] {
  const q = norm(query);
  if (!q) return index.slice(0, limit);
  return index
    .map((sub) => ({ sub, s: score(sub, q) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.sub.name.length - b.sub.name.length)
    .slice(0, limit)
    .map((r) => r.sub);
}

/**
 * Turn free-typed text into a usable subcategory when the index has no match — a reasonable
 * ENTERTAINMENT subcategory (the guidance: search must resolve a not-indexed show rather than
 * dead-end). Subject pool is creator-supplied cast; nothing is invented. Marked `source: "custom"`
 * so it can be promoted into the seed / Firestore index later.
 */
export function synthesizeSubcategory(query: string): Subcategory {
  const name = query.trim().replace(/\s+/g, " ").slice(0, 80) || "Custom show";
  return {
    slug: slugify(name),
    name,
    category: "TV Shows",
    kind: "custom",
    domain: "entertainment",
    aliases: [],
    stats: DEFAULT_ENTERTAINMENT_STATS,
    subjectSource: "creator_cast",
    source: "custom",
  };
}

/** True when a query resolves to something in the index (vs needing synthesis). */
export function hasMatch(query: string, index: Subcategory[]): boolean {
  return searchSubcategories(query, index, 1).length > 0;
}
