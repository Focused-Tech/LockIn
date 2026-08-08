/**
 * TEXTAREA AUTOSIZE — pure geometry, no DOM. Extracted so the growth/scroll rule is testable without
 * a layout engine (jsdom can't measure scrollHeight). The Locksmith input grows from one line to a
 * MAX of `maxLines`, then scrolls internally with NO visible scrollbar (the global rule hides it).
 *
 * The result's `overflowY` is "auto" only once content exceeds the cap — that's what makes the tail
 * REACHABLE (scrollable) instead of clipped. The caller then sets scrollTop to the bottom so the tail
 * is shown, and the text value is never truncated (autosize changes geometry, not content).
 */

export interface AutosizeInput {
  /** Measured content height of the textarea (el.scrollHeight after height was reset to "auto"). */
  scrollHeight: number;
  /** Computed line-height in px (from getComputedStyle). */
  lineHeightPx: number;
  /** Vertical padding in px (paddingTop + paddingBottom). */
  paddingYPx: number;
  /** Max visible lines before it scrolls. */
  maxLines: number;
}

export interface AutosizeResult {
  /** The height (px) to set on the textarea. */
  heightPx: number;
  /** "auto" when the content exceeds the cap (tail scrollable), else "hidden" (no scroll needed). */
  overflowY: "auto" | "hidden";
  /** Whether the content is capped (i.e. taller than maxLines). */
  capped: boolean;
}

/** Compute the autosize height + overflow for a textarea. Pure. */
export function autosizeTextarea({ scrollHeight, lineHeightPx, paddingYPx, maxLines }: AutosizeInput): AutosizeResult {
  const maxPx = lineHeightPx * maxLines + paddingYPx;
  const capped = scrollHeight > maxPx;
  return {
    heightPx: Math.min(scrollHeight, maxPx),
    overflowY: capped ? "auto" : "hidden",
    capped,
  };
}
