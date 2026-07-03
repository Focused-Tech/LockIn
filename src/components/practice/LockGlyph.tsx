/**
 * LOCK GLYPH — the LockIn padlock captured mid "unlocked → locked". Overlays a
 * leg card as it swipes away on selection: the shackle snaps shut and the glyph
 * pops in brand cayenne (the lock closing is the brand moment, so orange is on
 * message here — not a competing CTA).
 *
 * The RESTING (un-animated) state is the CLOSED lock, so reduced-motion users —
 * for whom the animation is suppressed in globals.css — still see a correct,
 * locked glyph that simply fades with the card.
 */
export function LockGlyph({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={"lock-glyph inline-flex text-accent " + (className ?? "")}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
      >
        {/* Shackle — drops into the body as it locks. */}
        <path
          className="lock-shackle"
          d="M8 11V7.5a4 4 0 0 1 8 0V11"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Body. */}
        <rect
          x="4.5"
          y="10.5"
          width="15"
          height="10"
          rx="2.5"
          fill="currentColor"
          fillOpacity="0.18"
          strokeWidth="2"
        />
        {/* Keyhole. */}
        <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
        <rect x="11.3" y="15.5" width="1.4" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
