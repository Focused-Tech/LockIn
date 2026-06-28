"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { playSound } from "@/lib/practice/sound";

export interface PlayedResult {
  correct: number;
  legs: number;
  net: number;
  won: boolean;
  perfect: boolean;
  nearMiss: boolean;
  message: string;
  streak: number;
  tierUp: boolean;
  newTierLabel: string;
}

type Kind = "win" | "nearmiss" | "loss";

function kindOf(r: PlayedResult): Kind {
  if (r.nearMiss) return "nearmiss"; // one short of perfect — the replay driver
  if (r.won) return "win";
  return "loss";
}

/**
 * Fast (sub-second) win/near-miss/loss "juice": animation + sound + coin
 * count-up + tier-up celebration + streak flourish. Sits over the contest until
 * the player taps through to the full results + leaderboard.
 */
export function PracticeResultAnimation({
  result,
  onContinue,
}: {
  result: PlayedResult;
  onContinue: () => void;
}) {
  const kind = kindOf(result);
  const [shown, setShown] = useState(0);
  const tick = useRef(0);

  // Sound on mount: outcome chime (+ tier-up sting if promoted).
  useEffect(() => {
    playSound(kind === "win" ? "win" : kind === "nearmiss" ? "nearmiss" : "loss");
    if (result.tierUp) setTimeout(() => playSound("tierup"), 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coin count-up of the net result (~600ms), with a soft tick every few steps.
  useEffect(() => {
    const target = result.net;
    const steps = 24;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(Math.round((target * i) / steps));
      if (++tick.current % 4 === 0) playSound("coin", 0.25);
      if (i >= steps) {
        setShown(target);
        clearInterval(id);
      }
    }, 600 / steps);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animClass =
    kind === "win"
      ? "practice-win"
      : kind === "nearmiss"
        ? "practice-nearmiss"
        : "practice-loss";

  const headline =
    kind === "win"
      ? result.perfect
        ? "Perfect card! 🔥"
        : "Winner!"
      : kind === "nearmiss"
        ? "So close — run it back!"
        : "Not this time.";

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-[rgba(10,13,18,0.82)] p-6">
      <div className={"relative w-full max-w-sm text-center " + animClass}>
        {/* Coin burst on a win */}
        {kind === "win" && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className="practice-burst absolute text-2xl"
                style={
                  {
                    "--dx": `${(Math.cos((i / 10) * 6.28) * 120).toFixed(0)}px`,
                    "--dy": `${(Math.sin((i / 10) * 6.28) * 120).toFixed(0)}px`,
                    animationDelay: `${i * 18}ms`,
                  } as React.CSSProperties
                }
              >
                🪙
              </span>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface-card p-6">
          <p
            className={
              "text-2xl font-bold " +
              (kind === "win"
                ? "text-win"
                : kind === "nearmiss"
                  ? "text-live"
                  : "text-muted")
            }
          >
            {headline}
          </p>
          <p className="mt-1 text-sm text-muted">
            {result.correct}/{result.legs} correct
          </p>

          <p
            className={
              "mt-4 text-4xl font-extrabold tabular-nums " +
              (result.net >= 0 ? "text-win" : "text-loss")
            }
          >
            {result.net >= 0 ? "+" : ""}
            {shown}
            <span className="ml-1 text-base font-medium text-muted">coins</span>
          </p>

          {result.tierUp && (
            <div className="practice-tierup mt-4 rounded-xl border border-accent-border bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
              ⬆ Promoted to {result.newTierLabel}!
            </div>
          )}
          {!result.tierUp && result.won && result.streak > 1 && (
            <p className="mt-3 text-sm font-medium text-accent">
              🔥 {result.streak} win streak!
            </p>
          )}

          <Button
            variant="accent"
            size="lg"
            className="mt-5 w-full"
            onClick={onContinue}
          >
            {kind === "loss" || kind === "nearmiss"
              ? "Try again →"
              : "See results →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
