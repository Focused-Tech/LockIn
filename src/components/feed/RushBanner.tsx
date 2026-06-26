"use client";

import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import type { FeedSlate } from "@/lib/feed";

/**
 * Pulsing purple banner shown at the top of the Explore feed whenever one or
 * more Card Rushes are live and joinable. Links to the soonest-locking rush.
 * Purple (#9B5DE5) is reserved for Card Rush; the glow uses `animate-rush-pulse`.
 */
export function RushBanner({ rushes }: { rushes: FeedSlate[] }) {
  // Feed is sorted by lock time, so the first joinable rush is the most urgent.
  const featured = rushes[0];
  if (!featured) return null;
  const more = rushes.length - 1;

  return (
    <Link href={`/app/slate/${featured.id}`} className="block">
      <div className="animate-rush-pulse rounded-lg border border-rush-border bg-rush-soft p-4 transition-transform hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rush opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rush" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-rush">
                ⚡ Card Rush live · {featured.rushMultiplier}x prizes
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {featured.title}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Locks in</p>
            <p className="text-sm font-semibold">
              <Countdown targetMs={featured.lockTimeMs} />
            </p>
          </div>
        </div>
        {more > 0 && (
          <p className="mt-2 text-xs text-rush">
            +{more} more rush{more > 1 ? "es" : ""} live now
          </p>
        )}
      </div>
    </Link>
  );
}
