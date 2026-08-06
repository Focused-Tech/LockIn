"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "./navIcons";

/**
 * Bottom tab bar (Addendum 2). PURE BLACK bar (#000) — no panel, no gradient, no card — with a 1px
 * top hairline (#1B222C) and env(safe-area-inset-bottom) reserved. THREE SLOTS with the label below
 * the glyph: THE FLOOR · BOARD · LOCKSMITH. Icons come from the single NAV_ICONS constant (inline
 * SVG / masked badge — no emoji, no icon library). Label 10.5px/600, letter-spacing .03em;
 * inactive #7A8496, active brand orange.
 *
 * The Floor is the feed in EVERY journey (§2a): same route (/app), active on /app and /app/beginner.
 * Locksmith opens the app's Locksmith help (ChatAssistant), reused via the `locksmith:open` event.
 */
const ACTIVE = "var(--brand-orange)";
const INACTIVE = "#7A8496";

const TABS = [
  { key: "floor" as const, href: "/app", label: "The Floor", match: (p: string) => p === "/app" || p.startsWith("/app/beginner") },
  { key: "board" as const, href: "/app/leaderboard", label: "Board", match: (p: string) => p.startsWith("/app/leaderboard") },
];

const slotClass = "flex flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5";
const labelStyle = (active: boolean): React.CSSProperties => ({
  fontSize: "10.5px",
  fontWeight: 600,
  letterSpacing: ".03em",
  color: active ? ACTIVE : INACTIVE,
});

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-nav-bar
      className="flex shrink-0"
      style={{
        background: "#000",
        borderTop: "1px solid #1B222C",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link key={t.key} href={t.href} aria-current={active ? "page" : undefined} className={slotClass}>
            <span style={{ color: active ? ACTIVE : INACTIVE }}>{NAV_ICONS[t.key](active)}</span>
            <span style={labelStyle(active)}>{t.label}</span>
          </Link>
        );
      })}

      {/* LOCKSMITH — her masked badge; opens the reused Locksmith help. Never a "current" route. */}
      <button
        type="button"
        aria-label="Locksmith — help & guide"
        onClick={() => window.dispatchEvent(new Event("locksmith:open"))}
        className={slotClass}
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span style={{ color: INACTIVE }}>{NAV_ICONS.locksmith(false)}</span>
        <span style={labelStyle(false)}>Locksmith</span>
      </button>
    </nav>
  );
}
