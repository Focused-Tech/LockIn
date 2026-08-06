"use client";

import { useState } from "react";

/**
 * BALANCE MASK (addendum). A balance renders MASKED (••••••) by default with an eye control; tapping
 * the eye reveals the figure. The masked state is the DEFAULT on every entry — it is component
 * mount state, never a remembered preference, so leaving the screen (unmount) and returning re-hides
 * it. Presentational only: never wrap a figure the user is being asked to act on (a stake being
 * confirmed, a deposit/withdrawal amount) — those always render in full.
 */
const MASK = "••••••";

/** Eye — open = revealed, struck-through = masked. Inline SVG, 1.75 stroke, currentColor. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function MaskedAmount({
  value,
  className,
}: {
  /** The fully-formatted figure to reveal (e.g. "$42.00" or "1,240"). */
  value: string;
  /** Styling for the figure itself (e.g. the wallet ".v cash" number class). */
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false); // masked by default; re-hides on remount

  return (
    <div className="flex items-center gap-2.5">
      <span className={className}>{revealed ? value : MASK}</span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Hide balance" : "Show balance"}
        aria-pressed={revealed}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground"
      >
        <EyeIcon open={revealed} />
      </button>
    </div>
  );
}
