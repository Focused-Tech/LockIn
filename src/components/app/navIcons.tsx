"use client";

import { useState } from "react";

/**
 * NAV ICON SET — SINGLE SWAPPABLE SOURCE (Addendum 2). One place, THREE entries. Inline SVG only —
 * no icon library, no icon font, no emoji. The two glyphs are stroke:currentColor (colour follows
 * the tab state), stroke-width 1.75, round caps/joins, 24×24 viewBox. The Locksmith slot is HER
 * BADGE (a masked circle avatar) — a recognised exception to the stroke style; if the image fails it
 * falls back to the KEY glyph, NEVER a fox.
 */

/** floor — SLATE + LEGS */
function FloorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4.4" width="16" height="15.2" rx="2.6" />
      <path d="M7.6 9.4h8.8" />
      <path d="M7.6 13h8.8" />
      <path d="M7.6 16.4h5" />
    </svg>
  );
}

/** board — LADDER + RISE */
function BoardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.6 20.4V6" />
      <path d="M15 20.4V6" />
      <path d="M6.6 9.6H15" />
      <path d="M6.6 14.4H15" />
      <path d="M17.6 8.6l2.6-2.6M20.2 6v3.4" />
    </svg>
  );
}

/** mic — the ONE Locksmith mic glyph (inline SVG, same set/style as send + nav). Replaces the old
 *  emoji mic so the input controls never mix icon sets. */
export function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/** send — PAPER PLANE. Same set/style as the mic + nav glyphs (inline SVG, currentColor, round
 *  caps/joins) so the Locksmith input controls never mix icon sets. Rendered at the mic's size. */
export function SendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.4 11.9 20 4.5 13 20.2l-2.6-6.1-6-2.2Z" />
      <path d="M10.4 14.1 20 4.5" />
    </svg>
  );
}

/** THE KEY — the ONLY Locksmith fallback (never a fox). */
function KeyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8.4" cy="8.6" r="4.2" />
      <path d="M11.5 11.7l7.4 7.4" />
      <path d="M16.4 16.6l2-2" />
      <path d="M14.2 14.4l2-2" />
    </svg>
  );
}

/** The Locksmith badge — her masked avatar, 26×26. Falls back to the KEY glyph on image error. */
export const LOCKSMITH_BADGE_SRC = "/foxpit/locksmith/locksmith_badge.png";

function LocksmithBadge({ active }: { active: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    // KEY fallback — inherits currentColor (tab state).
    return <KeyIcon />;
  }
  return (
    <span
      className="block h-[26px] w-[26px] overflow-hidden rounded-full"
      style={{
        border: `1.5px solid ${active ? "var(--brand-orange)" : "#3A4459"}`,
        boxShadow: active ? "0 0 0 2.5px rgba(252,62,1,.22)" : "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOCKSMITH_BADGE_SRC}
        alt=""
        className="h-full w-full object-cover"
        // Note: no manual DOM removal — React swaps to <KeyIcon/> via state, so there is no
        // parentNode-after-remove() throw. onError just flips state.
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** ONE constant, THREE entries. Each renders itself given the active state. */
export const NAV_ICONS = {
  floor: (_active: boolean) => <FloorIcon />,
  board: (_active: boolean) => <BoardIcon />,
  locksmith: (active: boolean) => <LocksmithBadge active={active} />,
} as const;
