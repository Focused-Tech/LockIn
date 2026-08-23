/**
 * SURFACE FLAG (Part A) — one codebase, two Vercel projects.
 *
 *   mobile   the store binary. Coins everywhere, CASH on SPORTS only.
 *   web      lockin.llc. Every category, cash included.
 *
 * Default is "mobile" so an unset variable changes nothing about existing behaviour: the existing
 * deployment keeps the tighter of the two policies rather than silently widening.
 *
 * The gate this file describes is enforced SERVER-SIDE, at the two functions that serve slate data
 * (`fetchFeedSlates` / `fetchSlate` in src/server/data/slates.ts). A slate the surface may not serve
 * is OMITTED FROM THE PAYLOAD — it is not returned and marked hidden, it is not returned at all.
 * Nothing in the client is trusted to hide it, because a client that is asked to hide something has
 * already been sent it.
 *
 * Client-safe: pure functions plus one env read, no server imports, so it is directly testable.
 */
import { CASH_SPORTS_CATEGORIES } from "@/lib/contest/architectSet";

export type Surface = "web" | "mobile";

/** Parse a raw env value. Anything not exactly "web" is "mobile" — see the default note above. */
export function resolveSurface(raw: string | undefined | null): Surface {
  return raw?.trim().toLowerCase() === "web" ? "web" : "mobile";
}

/**
 * The surface this deployment is. Read from NEXT_PUBLIC_SURFACE, which Next inlines at build time,
 * so it is a per-deployment constant rather than a per-request value.
 */
export const CURRENT_SURFACE: Surface = resolveSurface(process.env.NEXT_PUBLIC_SURFACE);

export const isWeb = (surface: Surface = CURRENT_SURFACE) => surface === "web";
export const isMobile = (surface: Surface = CURRENT_SURFACE) => surface === "mobile";

/** The shape the gate needs. Deliberately minimal so both FeedSlate and SlateDoc satisfy it. */
export interface SurfaceGateSlate {
  category: string;
  entryTiers: { tier: number }[];
}

/**
 * A slate is CASH when it offers at least one paid entry tier. A slate with no paid tier is a coins
 * contest and serves on every surface.
 */
export function isCashSlate(slate: SurfaceGateSlate): boolean {
  return (slate.entryTiers ?? []).some((t) => (t?.tier ?? 0) > 0);
}

/** Sports per the architect's allowlist. Unknown categories are NOT sports (fails closed). */
export function isCashSportsCategory(category: string): boolean {
  const c = (category ?? "").trim().toLowerCase();
  return CASH_SPORTS_CATEGORIES.some((s) => s.toLowerCase() === c);
}

/**
 * The one rule. Mobile omits CASH ENTERTAINMENT — a paid contest in any category that is not on the
 * sports allowlist. Everything else (all coins, and cash sports) serves on both surfaces.
 */
export function slateServesOnSurface(
  slate: SurfaceGateSlate,
  surface: Surface = CURRENT_SURFACE,
): boolean {
  if (surface === "web") return true;
  if (!isCashSlate(slate)) return true;
  return isCashSportsCategory(slate.category);
}

/** Why a slate was withheld, for the server log. Never sent to a client. */
export function surfaceOmissionReason(slate: SurfaceGateSlate, surface: Surface): string | null {
  if (slateServesOnSurface(slate, surface)) return null;
  return `cash entertainment ("${slate.category}") is not served on the ${surface} surface`;
}

/** Drop every slate this surface may not serve. */
export function filterForSurface<T extends SurfaceGateSlate>(
  slates: T[],
  surface: Surface = CURRENT_SURFACE,
): T[] {
  return slates.filter((s) => slateServesOnSurface(s, surface));
}
