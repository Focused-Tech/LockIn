"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

/**
 * Top-left of the shared header. The LockIn logo is a persistent HOME affordance
 * → The Fox Pit (/app/choose) on EVERY /app screen (tap the wordmark to go home).
 *
 * A back control (‹) appears only on deep screens. The top-level tab screens and
 * the two lane screens (Beginner /app/beginner, Advanced /app) show NO back
 * button — the logo is the way home, and changing lane happens at the Fox Pit,
 * not via an in-page control.
 */
const NO_BACK = new Set<string>([
  "/app/choose", // The Fox Pit landing — root screen, nothing above it
  "/app", // Explore (Advanced lane)
  "/app/beginner", // Beginner lane
  "/app/leaderboard", // Board
  "/app/rush", // Rush (route kept, unlinked)
  "/app/packages", // Creators
]);

export function HeaderBack() {
  const pathname = usePathname();
  const router = useRouter();

  const showBack = !NO_BACK.has(pathname);
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/app/choose");
  };

  return (
    <div className="flex items-center gap-1.5">
      {showBack && (
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden className="text-xl leading-none">
            ‹
          </span>
        </button>
      )}
      <Link
        href="/app/choose"
        aria-label="LockIn — home"
        className="transition-opacity hover:opacity-80"
      >
        <Logo />
      </Link>
    </div>
  );
}
