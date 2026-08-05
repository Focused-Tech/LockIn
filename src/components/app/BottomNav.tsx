"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Persistent bottom tab bar — the app's primary navigation (design: prototype
 * `.bot-nav`). "Creators" is a placeholder destination for the APK test that
 * reuses existing data (the pick-package marketplace); the dedicated screen is
 * built later. (The "Rush" tab was removed — Card Rush surfaces are hidden — but
 * the /app/rush route is intentionally kept in place, just unlinked.)
 */
const TABS = [
  { href: "/app", label: "The Floor", icon: "◎", match: (p: string) => p === "/app" },
  {
    href: "/app/leaderboard",
    label: "Board",
    icon: "🏅",
    match: (p: string) => p.startsWith("/app/leaderboard"),
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
