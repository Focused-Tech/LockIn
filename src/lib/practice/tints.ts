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
  // Category → color key (from the slate art + arena-workflow-BASE prototype).
  // THE single source of truth for every slate/pick card's outline, header bar,
  // and selection glow, app-wide. Any category not listed → NEUTRAL_HUE fallback.
  NFL: "#E0703C",
  NBA: "#1D6FE8",
  UFC: "#E85454",
  Soccer: "#3CCB7F",
  Crypto: "#F5A623",
  Music: "#B06FCE",
  Esports: "#7C5CF5",
  MLB: "#E8EAED",
  NHL: "#5BC0DE",
  Politics: "#9B4DCA",
  Weather: "#4FC3E8",
  Awards: "#E8C24F",
  Stocks: "#26A69A",
  Economics: "#3FA796",
  AI: "#5B8DEF",
  Forex: "#7FB800",
  World: "#C99A2E",
  // NASCAR is specced as a #C0392B→#E67E22 gradient; the tint system uses a single
  // hue, so we use the orange end here. (Gradient outline is a follow-up.)
  NASCAR: "#E67E22",
  Boxing: "#B03060",
  Tennis: "#B6E13B",
  Golf: "#2E8B57",
  Entertainment: "#D6249F",
  "TV Shows": "#8A5CF6",
};

const NEUTRAL_HUE = "#2E6BF0";

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
