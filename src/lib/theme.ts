/**
 * THEME SWITCHES.
 *
 * ACCENT_VARIANT fixes the translucent cayenne buttons reading BROWN (not orange)
 * at low opacity over the dark #0A0D12 bg. At 10% opacity too much dark shows
 * through and the orange muddies. Three variants (all still TRANSLUCENT — brand
 * rule, never a solid fill) live in globals.css under [data-accent="a|b|c"]:
 *
 *   a — same hue, raised opacity (0.18 fill / 0.50 border)
 *   b — warmer/brighter base + raised opacity (reads clearly orange)   ← default
 *   c — subtle fill + a crisp near-solid orange border (outline glow)
 *
 * TO SWITCH: change this one value and redeploy. `data-accent` on <html> (set in
 * src/app/layout.tsx) selects the variant; it affects every `bg-accent-soft` /
 * `border-accent-border` app-wide (choose screen, practice, etc.).
 */
export const ACCENT_VARIANT: "a" | "b" | "c" = "b";
