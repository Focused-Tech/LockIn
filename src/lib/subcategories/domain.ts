/**
 * Which VOICE a top-level category speaks (B/D/E). Entertainment categories generate with the
 * entertainment stems + draw subjects from a cast; everything else is sports. Client- and server-safe.
 */
import type { QuestionDomain } from "./types";

const ENTERTAINMENT_CATEGORIES = new Set(["TV Shows", "Entertainment", "Music"]);

export function domainForCategory(category: string): QuestionDomain {
  return ENTERTAINMENT_CATEGORIES.has(category) ? "entertainment" : "sports";
}
