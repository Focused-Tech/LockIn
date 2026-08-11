"use server";

/**
 * SUBCATEGORY SEARCH ACTION (B) — the creator's search box calls this. It returns ranked matches from
 * the LIVE index (Firestore `subcategories` merged OVER the bundled seed) plus, when nothing matches, a
 * synthesized subcategory so the box never dead-ends. Because the live index reads Firestore, a show
 * added as a Firestore doc is searchable with NO deploy.
 */
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import { SUBCATEGORY_SEED } from "./seed";
import { searchSubcategories, synthesizeSubcategory } from "./search";
import type { Subcategory } from "./types";

let cache: { at: number; index: Subcategory[] } | null = null;
const TTL_MS = 60_000;

/** Firestore over seed: the seed is the guaranteed baseline (works pre-seed / with no admin creds);
 *  Firestore docs add or override by slug (this is the "extend without a deploy" path). */
async function loadIndex(): Promise<Subcategory[]> {
  const bySlug = new Map<string, Subcategory>();
  for (const s of SUBCATEGORY_SEED) bySlug.set(s.slug, s);
  try {
    const snap = await adminDb().collection(COLLECTIONS.subcategories).get();
    snap.forEach((d) => {
      const data = d.data() as Partial<Subcategory>;
      if (data?.name && Array.isArray(data?.stats)) bySlug.set(d.id, { ...(data as Subcategory), slug: d.id });
    });
  } catch {
    /* no admin creds / pre-seed — the bundled seed still answers every search */
  }
  return [...bySlug.values()];
}

export interface SubcategorySearchResult {
  matches: Subcategory[];
  /** present only when nothing matched — a usable, creator-editable subcategory from the typed text. */
  fallback: Subcategory | null;
}

export async function searchSubcategoriesAction(query: string): Promise<SubcategorySearchResult> {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) cache = { at: now, index: await loadIndex() };
  const matches = searchSubcategories(query, cache.index);
  const fallback = query.trim().length > 0 && matches.length === 0 ? synthesizeSubcategory(query) : null;
  return { matches, fallback };
}
