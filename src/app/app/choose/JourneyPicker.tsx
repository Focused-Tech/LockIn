"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyLane } from "@/lib/firebase/types";
import { setJourneyLane } from "@/app/app/beginner/actions";
import "./journey.css";

/**
 * The Fox Pit — the app's front door / journey selector (foxpit_landing.html).
 * A root screen: NO back chevron (nothing sits above it). Four one-tap journeys,
 * each named by its 4px left edge colour + currency tag:
 *   Beginner (creator purple / Coins) · Advanced (brand orange / Cash) ·
 *   Creator (creator purple / Cash) · The Fox Pit practice (fox gold / Coins).
 * The active lane wears the "Current" pill, which also resumes that lane.
 *
 * Beginner/Advanced persist the lane then route; Creator is a role (not a lane)
 * so it navigates to the creator dashboard (which gates non-creators to apply).
 */
const COLORS = {
  creator: { c: "#7C5CF5", cd: "#3B2C93", soft: "rgba(124,92,245,.14)" },
  orange: { c: "#FF5A1F", cd: "#8E2C01", soft: "rgba(255,90,31,.14)" },
  fox: { c: "#F0C463", cd: "#7A5F16", soft: "rgba(240,196,99,.14)" },
} as const;

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

  const resume = () => {
    if (!currentLane) return;
    setBusy("continue");
    router.push(laneHref(currentLane));
  };

  const goCreator = () => {
    setBusy("creator");
    router.push("/app/creator");
  };

  const goFoxPit = () => {
    setBusy("foxpit");
    router.push("/app/foxpit");
  };

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* hero */}
      <header className="practice-deal pt-3 text-center">
        <div className="jp-med">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/arena/fox-crest.png" alt="" aria-hidden />
        </div>
        <h1 className="jp-h1">The Fox Pit</h1>
        <p className="jp-tag">
          Use your skills to Lock In and win up to <b>1000x</b> in cash payouts.
        </p>
      </header>

      <p className="jp-sh practice-deal" style={{ animationDelay: "80ms" }}>
        {currentLane ? "Switch journey" : "Choose your journey"}
      </p>

      <div className="flex flex-col gap-3">
        {/* Beginner */}
        <JourneyCard
          title="Beginner — simple & guided"
          body="Creator picks, plain-language calls, coins not odds. We teach you up to the full game, step by step."
          tag="Coins"
          color="creator"
          active={currentLane === "beginner"}
          busy={busy === "beginner"}
          disabled={pending}
          delayMs={140}
          onClick={() => pickLane("beginner")}
          onResume={resume}
        />

        {/* Advanced */}
        <JourneyCard
          title="Advanced — full market"
          body="Here knowledge reigns supreme. Every contest, every category, real payouts. Lock In to win."
          tag="Cash"
          color="orange"
          active={currentLane === "advanced"}
          busy={busy === "advanced"}
          disabled={pending}
          delayMs={190}
          onClick={() => pickLane("advanced")}
          onResume={resume}
        />

        {/* Creator — a role, not a lane */}
        <JourneyCard
          title="Creator — host contests"
          body={
            creatorVerified
              ? "Build prediction slates with AI-drafted questions, sell pick packages, and earn."
              : "Apply to host prediction contests for your audience and earn."
          }
          tag="Cash"
          color="creator"
          active={false}
          busy={busy === "creator"}
          disabled={pending}
          delayMs={240}
          onClick={goCreator}
        />

        {/* The Fox Pit — painted practice journey (lobby → tower → rooms) */}
        <JourneyCard
          title="The Fox Pit — practice journey"
          body="Walk into the Pit. Choose the floor, face the boss, run it back."
          tag="Coins"
          color="fox"
          active={false}
          busy={busy === "foxpit"}
          disabled={pending}
          delayMs={290}
          onClick={goFoxPit}
        />
      </div>

      {pending && (
        <p className="text-center text-sm text-muted">Setting up your feed…</p>
      )}
    </div>
  );
}

function JourneyCard({
  title,
  body,
  tag,
  color,
  active,
  busy,
  disabled,
  delayMs,
  onClick,
  onResume,
}: {
  title: string;
  body: string;
  tag: string;
  color: keyof typeof COLORS;
  active: boolean;
  busy: boolean;
  disabled: boolean;
  delayMs: number;
  onClick: () => void;
  /** The "Current" pill (active card only) resumes the user's saved lane. */
  onResume?: () => void;
}) {
  const t = COLORS[color];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className="jp-j practice-deal"
      style={
        {
          animationDelay: `${delayMs}ms`,
          "--jc": t.c,
          "--jcd": t.cd,
          "--jsoft": t.soft,
        } as React.CSSProperties
      }
    >
      <div className="jp-jt">
        <b>{title}</b>
        {active && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Resume where you left off"
            className="jp-cur"
            onClick={(e) => {
              e.stopPropagation();
              onResume?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onResume?.();
              }
            }}
          >
            Current
          </span>
        )}
      </div>
      <p className="jp-body">{body}</p>
      <div className="jp-jf">
        <span className="tag">{tag}</span>
        <span className="cv" aria-hidden>
          ›
        </span>
      </div>
    </button>
  );
}
