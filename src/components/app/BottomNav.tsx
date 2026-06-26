"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Persistent bottom tab bar — the app's primary navigation (design: prototype
 * `.bot-nav`). Four steady-state tabs. "Rush" and "Creators" are placeholder
 * destinations for the APK test that reuse existing data (Rush = the feed
 * filtered to Card Rush; Creators = the pick-package marketplace); the dedicated
 * screens are built later as real features.
 */
const TABS = [
  { href: "/app", label: "Explore", icon: "◎", match: (p: string) => p === "/app" },
  {
    href: "/app/leaderboard",
    label: "Board",
    icon: "🏅",
    match: (p: string) => p.startsWith("/app/leaderboard"),
  },
  {
    href: "/app/rush",
    label: "Rush",
    icon: "⚡",
    match: (p: string) => p.startsWith("/app/rush"),
  },
  {
    href: "/app/packages",
    label: "Creators",
    icon: "★",
    match: (p: string) => p.startsWith("/app/packages"),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 border-t border-border bg-surface">
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex flex-1 flex-col items-center gap-0.5 pb-3 pt-2 text-[9px] font-medium transition-colors " +
              (active ? "text-accent" : "text-muted hover:text-foreground")
            }
          >
            <span className="text-lg leading-none" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
