"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

/**
 * Top-left of the shared header. On the four TOP-LEVEL TAB screens (which own
 * the bottom nav) it shows the LockIn logo (home link). On every other /app
 * screen it shows a BACK control that returns to the logical previous screen
 * (history back, with a sane fallback when there's no in-app history).
 */
const TOP_LEVEL = new Set<string>([
  "/app", // Explore
  "/app/beginner", // Beginner feed (Explore tab redirects beginners here)
  "/app/leaderboard", // Board
  "/app/rush", // Rush
  "/app/packages", // Creators
]);

export function HeaderBack() {
  const pathname = usePathname();
  const router = useRouter();

  if (TOP_LEVEL.has(pathname)) {
    return (
      <Link href="/app" aria-label="LockIn home">
        <Logo />
      </Link>
    );
  }

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/app");
  };

  return (
    <button
      type="button"
      onClick={back}
      aria-label="Back"
      className="flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
    >
      <span aria-hidden className="text-xl leading-none">
        ‹
      </span>
      <Logo />
    </button>
  );
}
