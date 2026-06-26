"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import type { JourneyLane } from "@/lib/firebase/types";
import { setJourneyLane } from "@/app/app/beginner/actions";

/**
 * Choose-your-journey screen. Persists the lane, then routes:
 *  - beginner -> /app/beginner (the guided journey)
 *  - advanced -> /app (the existing Explore)
 * Reached by every account whose journeyLane is unset (new signups land here
 * right after onboarding; existing lane-less accounts are sent here from /app).
 */
export function JourneyPicker() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState<JourneyLane | null>(null);

  const choose = (lane: JourneyLane) =>
    startTransition(async () => {
      setChoosing(lane);
      await setJourneyLane(lane);
      router.replace(lane === "beginner" ? "/app/beginner" : "/app");
    });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col items-center gap-4 pt-2">
        <Logo />
      </header>

      <div className="text-center">
        <h1 className="text-2xl font-semibold">How do you want to start?</h1>
        <p className="mt-1 text-sm text-muted">
          You can switch lanes any time from the feed.
        </p>
      </div>

      <button
        type="button"
        onClick={() => choose("beginner")}
        disabled={pending}
        aria-busy={choosing === "beginner"}
        className="flex flex-col gap-1 rounded-xl border border-accent-border bg-accent-soft p-5 text-left transition-colors disabled:opacity-60"
      >
        <span className="text-base font-bold text-accent">
          Beginner — simple &amp; guided
        </span>
        <span className="text-sm text-muted">
          Creator picks, plain-language calls, coins not odds. We teach you up to
          the full game, step by step.
        </span>
      </button>

      <button
        type="button"
        onClick={() => choose("advanced")}
        disabled={pending}
        aria-busy={choosing === "advanced"}
        className="flex flex-col gap-1 rounded-xl border border-border bg-surface-card p-5 text-left transition-colors disabled:opacity-60"
      >
        <span className="text-base font-bold text-foreground">
          Advanced — full market
        </span>
        <span className="text-sm text-muted">
          Every contest, odds, and parlays. The complete Explore feed.
        </span>
      </button>

      {pending && (
        <p className="text-center text-sm text-muted">Setting up your feed…</p>
      )}
    </main>
  );
}
