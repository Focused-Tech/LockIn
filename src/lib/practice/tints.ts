/**
 * PRACTICE / ARENA — informational color tints (client-safe, pure).
 *
 * The color rebalance moves practice UI off "everything is orange" onto SEMANTIC
 * color: green = money/play, teal/amber/red = difficulty, and CATEGORY-tinted
 * outlines carry information (which sport/topic a slate is) instead of brand.
 *
 * These are OUTLINE/soft-fill tints only — never solid fills, and orange stays
 * reserved for the one primary action per screen + the wordmark (brand rule).
 *
 * No category color ramp existed in the design system before this, so it lives
 * here as static reference data (not a DB/data-layer concern).
 */

export interface Tint {
  /** Solid hue — for text/icon accents and the crisp outline color. */
  color: string;
  /** Translucent fill for a tinted card background. */
  soft: string;
  /** Translucent border for a tinted card outline. */
  border: string;
}

/** #RRGGBB → rgba(r,g,b,a). */
function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Build a full tint (color + soft fill + outline border) from one base hue. */
export function tintFromHue(hex: string): Tint {
  return { color: hex, soft: rgba(hex, 0.1), border: rgba(hex, 0.55) };
}

/**
 * Distinct base hue per category — chosen for separability across the ramp so a
 * glance at an outline reads the sport/topic. Cayenne (#FF3B00) is deliberately
 * absent (reserved for brand). Falls back to a neutral steel for unknowns.
 */
const CATEGORY_HUE: Record<string, string> = {
  NASCAR: "#F97316", // orange
  Esports: "#A855F7", // purple
  UFC: "#EF4444", // red
  Boxing: "#F43F5E", // rose
  Tennis: "#84CC16", // lime
  Golf: "#10B981", // emerald
  Soccer: "#14B8A6", // teal
  NFL: "#6366F1", // indigo
  NBA: "#EC4899", // pink
  MLB: "#0EA5E9", // sky
  NHL: "#06B6D4", // cyan
  Entertainment: "#D946EF", // fuchsia
  "TV Shows": "#8B5CF6", // violet
  Music: "#C084FC", // light violet
  Politics: "#64748B", // slate
  Geopolitics: "#0D9488", // deep teal
  Crypto: "#EAB308", // gold
  Economics: "#22C55E", // green
  Weather: "#38BDF8", // light blue
  Viral: "#FB7185", // coral-rose
};

const NEUTRAL_HUE = "#6B7A8E";

/** Category → outline/soft tint. Distinct per sport/topic; neutral fallback. */
export function categoryTint(category: string): Tint {
  return tintFromHue(CATEGORY_HUE[category] ?? NEUTRAL_HUE);
}

/**
 * Creator PLAYSTYLE lean → outline tint. Derived from the creator's difficulty
 * indicator (an honest style signal, not a fabricated win rate):
 *   favorites-lean (easy)  → teal   — plays the chalk
 *   balanced (medium)      → amber   — a bit of everything
 *   underdog-lean (hard)   → red     — hunts live underdogs
 */
export type PlaystyleLean = "favorites" | "balanced" | "underdog";

const PLAYSTYLE_HUE: Record<PlaystyleLean, string> = {
  favorites: "#2DD4BF", // teal
  balanced: "#F5A623", // amber
  underdog: "#FF5D5D", // red/coral
};

export function playstyleLeanFor(
  difficulty: "easy" | "medium" | "hard",
): PlaystyleLean {
  return difficulty === "easy"
    ? "favorites"
    : difficulty === "hard"
      ? "underdog"
      : "balanced";
}

export function playstyleTint(difficulty: "easy" | "medium" | "hard"): Tint {
  return tintFromHue(PLAYSTYLE_HUE[playstyleLeanFor(difficulty)]);
}

export const PLAYSTYLE_LABEL: Record<PlaystyleLean, string> = {
  favorites: "Favorites-lean",
  balanced: "Balanced",
  underdog: "Underdog-lean",
};
