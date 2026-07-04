"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyLane } from "@/lib/firebase/types";
import { setJourneyLane } from "@/app/app/beginner/actions";

/**
 * Journey hub — the app's front door. Three first-class, one-tap journeys
 * (Beginner / Advanced / Creator) plus a "Continue to my feed" shortcut that
 * respects the saved lane (so returning users aren't forced to re-pick).
 * Reachable any time via the "Switch journey" link in the Explore header.
 *
 * Beginner/Advanced persist the lane then route; Creator is a role (not a lane)
 * so it just navigates to the creator dashboard (which gates non-creators to the
 * application flow).
 */
export function JourneyPicker({
  currentLane,
  creatorVerified,
}: {
  currentLane: JourneyLane | null;
  creatorVerified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const laneHref = (lane: JourneyLane) =>
    lane === "beginner" ? "/app/beginner" : "/app";

  const pickLane = (lane: JourneyLane) =>
    startTransition(async () => {
      setBusy(lane);
      await setJourneyLane(lane);
      router.replace(laneHref(lane));
    });

  const continueToFeed = () => {
    if (!currentLane) return;
    setBusy("continue");
    router.push(laneHref(currentLane));
  };

  const goCreator = () => {
    setBusy("creator");
    router.push("/app/creator");
  };

  const goPractice = () => {
    setBusy("practice");
    // Hub dissolved: the Practice card opens the arena chooser directly.
    router.push("/app/practice/arena/chooser");
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="practice-deal flex flex-col items-center gap-2 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/arena/fox-crest.png"
          alt=""
          aria-hidden
          width={92}
          height={92}
          className="h-[92px] w-[92px] rounded-full border-2 border-accent-border object-cover"
          style={{ boxShadow: "0 0 22px rgba(255,59,0,0.4)" }}
        />
      </header>

      <div className="practice-deal text-center" style={{ animationDelay: "50ms" }}>
        <h1
          className="text-3xl font-extrabold tracking-wide text-accent"
          style={{ textShadow: "0 0 18px rgba(255,59,0,0.45)" }}
        >
          The Fox Pit
        </h1>
        <p className="mt-1 text-sm text-muted">
          Jump back into your feed, or switch lanes — your choice, any time.
        </p>
      </div>

      {/* Continue — only when a lane is already set (no forced re-pick) */}
      {currentLane && (
        <button
          type="button"
          onClick={continueToFeed}
          disabled={pending}
          aria-busy={busy === "continue"}
          style={{ animationDelay: "100ms" }}
          className="practice-deal flex items-center justify-between rounded-xl border border-accent-border bg-accent-soft p-5 text-left transition active:scale-[0.98] disabled:opacity-60"
        >
          <span>
            <span className="block text-base font-bold text-accent">
              Continue to my feed
            </span>
            <span className="block text-sm text-muted">
              Back to your{" "}
              {currentLane === "beginner" ? "Beginner" : "Advanced"} journey
            </span>
          </span>
          <span className="text-xl text-accent">→</span>
        </button>
      )}

      <p
        className="practice-deal pt-1 text-xs font-medium uppercase tracking-wide text-muted"
        style={{ animationDelay: "150ms" }}
      >
        {currentLane ? "Switch journey" : "Choose your journey"}
      </p>

      {/* Beginner */}
      <JourneyCard
        title="Beginner — simple & guided"
        body="Creator picks, plain-language calls, coins not odds. We teach you up to the full game, step by step."
        active={currentLane === "beginner"}
        busy={busy === "beginner"}
        disabled={pending}
        delayMs={190}
        onClick={() => pickLane("beginner")}
      />

      {/* Advanced */}
      <JourneyCard
        title="Advanced — full market"
        body="Every contest, odds, and parlays. The complete Explore feed."
        active={currentLane === "advanced"}
        busy={busy === "advanced"}
        disabled={pending}
        delayMs={240}
        onClick={() => pickLane("advanced")}
      />

      {/* Creator — first-class entry (a role, not a lane) */}
      <JourneyCard
        title="Creator — host contests"
        body={
          creatorVerified
            ? "Build prediction slates with AI-suggested odds, sell pick packages, and earn."
            : "Apply to host prediction contests for your audience and earn."
        }
        active={false}
        busy={busy === "creator"}
        disabled={pending}
        delayMs={290}
        onClick={goCreator}
      />

      {/* Practice — play-money multiplayer (coins are score; nothing cashable) */}
      <JourneyCard
        title="Practice arena — play with friends"
        body="Play-money contests for coins, rank & bragging rights. Host AI or manual slates, invite friends, climb the tiers. No real money, ever."
        active={false}
        busy={busy === "practice"}
        disabled={pending}
        delayMs={340}
        onClick={goPractice}
      />

      {pending && (
        <p className="text-center text-sm text-muted">Setting up your feed…</p>
      )}
    </div>
  );
}

function JourneyCard({
  title,
  body,
  active,
  busy,
  disabled,
  delayMs,
  onClick,
}: {
  title: string;
  body: string;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  delayMs: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      style={{ animationDelay: `${delayMs}ms` }}
      className={
        "practice-deal flex flex-col gap-1 rounded-xl border p-5 text-left transition active:scale-[0.98] disabled:opacity-60 " +
        (active
          ? "border-accent-border bg-accent-soft"
          : "border-border bg-surface-card hover:bg-surface")
      }
    >
      <span className="flex items-center gap-2 text-base font-bold text-foreground">
        {title}
        {active && (
          <span className="rounded-full border border-accent-border px-2 py-0.5 text-[10px] font-medium uppercase text-accent">
            Current
          </span>
        )}
      </span>
      <span className="text-sm text-muted">{body}</span>
    </button>
  );
}
