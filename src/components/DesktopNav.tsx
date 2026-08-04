"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Pill } from "@/components/ui";
import { ProBadge } from "@/components/ProBadge";
import { formatCents } from "@/lib/utils";

const LINKS = [
  { href: "/app", label: "Explore", match: (p: string) => p === "/app" },
  { href: "/app/packages", label: "Packages", match: (p: string) => p.startsWith("/app/packages") },
  { href: "/app/leaderboard", label: "Ranks", match: (p: string) => p.startsWith("/app/leaderboard") },
  { href: "/app/creator", label: "Creator", match: (p: string) => p.startsWith("/app/creator") },
  { href: "/app/pro", label: "Pro", match: (p: string) => p.startsWith("/app/pro") },
];

/**
 * Desktop-only top navbar (≥1024px). Logo left, nav center with a cayenne active
 * link, profile + balances right. Hidden on mobile, which keeps its per-page
 * headers. Sticky so it persists while the page scrolls.
 */
export function DesktopNav({
  username,
  coinBalance,
  cashBalanceCents,
  isPro,
}: {
  username: string;
  coinBalance: number;
  cashBalanceCents: number;
  isPro: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur lg:block">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/app">
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors " +
                  (active
                    ? "text-accent"
                    : "text-muted hover:text-foreground")
                }
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/app/wallet" className="flex items-center gap-2">
            <Pill tone="win">{coinBalance} coins</Pill>
            <Pill tone="accent">{formatCents(cashBalanceCents)}</Pill>
          </Link>
          <Link
            href="/app/creator"
            className="rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
          >
            + Host
          </Link>
          <Link
            href="/app/profile"
            aria-label="Your profile"
            className="flex items-center gap-1.5"
          >
            {isPro && <ProBadge />}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-sm font-semibold text-foreground hover:bg-surface-card">
              {username.charAt(0).toUpperCase()}
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
