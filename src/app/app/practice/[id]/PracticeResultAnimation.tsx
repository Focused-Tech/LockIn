"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { playSound, playReveal } from "@/lib/practice/sound";

/** One leg, shaped for the leg-by-leg settlement reveal. */
export interface RevealLeg {
  question: string;
  /** The option the player locked in (shown when they hit). */
  pickedLabel: string;
  /** The option that actually came in. */
  correctLabel: string;
  hit: boolean;
}

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
  /** Per-leg outcomes, in slate order — drives the reveal. */
  revealLegs: RevealLeg[];
  /** Spot race: the top spot (1–3) claimed, the winnings multiplier applied. */
  spot: number | null;
  spotBonus: number;
}

type Kind = "win" | "nearmiss" | "loss";
type Phase = "reveal" | "tierup" | "outcome";

function kindOf(r: PlayedResult): Kind {
  if (r.nearMiss) return "nearmiss"; // one short of perfect — the replay driver
  if (r.won) return "win";
  return "loss";
}

// Deterministic full-screen coin rain (no Math.random → no flicker), well spread.
const RAIN = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 5) % 100,
  delay: (i % 8) * 80,
  dur: 1200 + (i % 5) * 220,
}));

const WIN_FILL = "border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.12)]";
const LOSS_FILL = "border-[rgba(232,84,84,0.45)] bg-[rgba(232,84,84,0.12)]";

/**
 * Settlement "juice": the slate resolves ONE LEG AT A TIME with a rising tick so
 * tension builds and the deciding leg lands last — then an over-the-top payoff
 * (coin burst + rain + flash on a win, a "SO CLOSE" stamp on a near-miss, a
 * full-screen takeover on a tier-up). Sits over the contest until the player taps
 * into the next round or through to the full results + leaderboard.
 *
 * Audio is HOOKED but silent until sound files ship: reveal tick (rising),
 * win/nearmiss/loss chime, "stamp" impact, tier-up swell, coin count ticks.
 */
export function PracticeResultAnimation({
  result,
  onContinue,
  onNextRound,
  nextPending,
  nextError,
}: {
  result: PlayedResult;
  /** See full results + leaderboard (dismiss the overlay). */
  onContinue: () => void;
  /** Start another round in the same category — the "one more" loop. */
  onNextRound: () => void;
  nextPending: boolean;
  nextError: string | null;
}) {
  const kind = kindOf(result);

  // Reveal order: for a near-miss, the single missed leg lands LAST (green,
  // green, green … then the heartbreak). Otherwise natural slate order.
  const [order] = useState<number[]>(() => {
    const idx = result.revealLegs.map((_, i) => i);
    if (result.nearMiss) {
      const missAt = result.revealLegs.findIndex((l) => !l.hit);
      if (missAt >= 0) {
        idx.splice(missAt, 1);
        idx.push(missAt);
      }
    }
    return idx;
  });

  const [phase, setPhase] = useState<Phase>("reveal");
  const [landed, setLanded] = useState(0);
  const [shown, setShown] = useState(0);
  const [countDone, setCountDone] = useState(false);
  const tick = useRef(0);

  // PHASE 1 — leg-by-leg reveal. Each leg lands on a beat with a rising tick;
  // total stays inside revealMaxTotalMs so the drama never drags.
  useEffect(() => {
    const n = order.length;
    const beat = Math.min(
      PRACTICE_CONFIG.audio.revealBeatMs,
      Math.floor(PRACTICE_CONFIG.audio.revealMaxTotalMs / Math.max(1, n)),
    );
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < n; i++) {
      timers.push(
        setTimeout(() => {
          setLanded(i + 1);
          playReveal(i); // pitch climbs leg by leg
        }, i * beat),
      );
    }
    // Hold a beat on the deciding leg, then advance.
    timers.push(
      setTimeout(
        () => setPhase(result.tierUp ? "tierup" : "outcome"),
        n * beat + 380,
      ),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PHASE 2 (optional) — tier-up takeover. Stops the flow, swells, auto-advances.
  useEffect(() => {
    if (phase !== "tierup") return;
    playSound("tierup");
    const t = setTimeout(() => setPhase("outcome"), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  // PHASE 3 — outcome payoff: chime, (stamp on near-miss), coin count-up slam.
  useEffect(() => {
    if (phase !== "outcome") return;
    playSound(kind === "win" ? "win" : kind === "nearmiss" ? "nearmiss" : "loss");
    if (kind === "nearmiss") {
      const s = setTimeout(() => playSound("stamp"), 160); // "SO CLOSE" slam
      // (cleanup below also clears the count interval)
      const target = result.net;
      const steps = 24;
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        setShown(Math.round((target * i) / steps));
        if (++tick.current % 4 === 0) playSound("coin", { volume: 0.25 });
        if (i >= steps) {
          setShown(target);
          setCountDone(true);
          clearInterval(id);
        }
      }, 600 / steps);
      return () => {
        clearTimeout(s);
        clearInterval(id);
      };
    }
    const target = result.net;
    const steps = 24;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(Math.round((target * i) / steps));
      if (++tick.current % 4 === 0) playSound("coin", { volume: 0.25 });
      if (i >= steps) {
        setShown(target);
        setCountDone(true);
        clearInterval(id);
      }
    }, 600 / steps);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const headline =
    kind === "win"
      ? result.perfect
        ? "Perfect card! 🔥"
        : "Winner!"
      : kind === "nearmiss"
        ? "So close!"
        : "Not this time.";

  // Streak badge intensifies as it grows: faster pulse + more flame.
  const streakPulse = `${Math.max(0.42, 1.1 - (result.streak - 2) * 0.13).toFixed(2)}s`;
  const flames = "🔥".repeat(Math.min(3, Math.floor((result.streak - 1) / 3) + 1));

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center overflow-hidden bg-[rgba(10,13,18,0.88)] p-6">
      {/* Win-only: full-screen flash + coin rain */}
      {phase === "outcome" && kind === "win" && (
        <>
          <div className="practice-flash pointer-events-none fixed inset-0 z-[1] bg-[rgba(34,197,94,0.35)]" />
          <div className="pointer-events-none fixed inset-0 z-[2]">
            {RAIN.map((r, i) => (
              <span
                key={i}
                className="practice-coin-rain absolute text-2xl"
                style={
                  {
                    left: `${r.left}%`,
                    top: "-10vh",
                    animationDelay: `${r.delay}ms`,
                    "--dur": `${r.dur}ms`,
                  } as React.CSSProperties
                }
              >
                🪙
              </span>
            ))}
          </div>
        </>
      )}

      {/* TIER-UP TAKEOVER — full-screen moment, not a toast */}
      {phase === "tierup" ? (
        <div className="relative z-[3] flex flex-col items-center text-center">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <span className="practice-ring absolute inset-0 rounded-full border-2 border-accent-border" />
            <span className="practice-ring absolute inset-0 rounded-full border-2 border-accent-border [animation-delay:0.18s]" />
            <span className="practice-tier-takeover text-6xl">🏆</span>
          </div>
          <p className="practice-tier-rise mt-5 text-xs uppercase tracking-[0.3em] text-muted">
            Rank up
          </p>
          <p className="practice-tier-rise mt-1 text-3xl font-extrabold text-accent">
            {result.newTierLabel}
          </p>
        </div>
      ) : (
        <div
          className={
            "relative z-[3] w-full max-w-sm" +
            (nextPending ? " practice-sweep-out" : "") // clear the board for the deal
          }
        >
          {/* Leg-by-leg reveal list (carries from reveal → outcome) */}
          <div className="rounded-2xl border border-border bg-surface-card p-5">
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted">
              {phase === "reveal"
                ? "Settling…"
                : `${result.correct}/${result.legs} correct`}
            </p>

            <div className="mt-3 flex flex-col gap-1.5">
              {order.map((legIdx, pos) => {
                const leg = result.revealLegs[legIdx];
                if (!leg) return null;
                const isLanded = pos < landed;
                if (!isLanded) {
                  return (
                    <div
                      key={legIdx}
                      className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm opacity-40"
                    >
                      <span className="truncate text-muted">{leg.question}</span>
                      <span className="text-muted">•••</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={legIdx}
                    className={
                      "practice-leg-land flex items-center justify-between rounded border px-3 py-2 text-sm " +
                      (leg.hit
                        ? "practice-leg-hit " + WIN_FILL
                        : "practice-leg-miss " + LOSS_FILL)
                    }
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={leg.hit ? "text-win" : "text-loss"}>
                        {leg.hit ? "✓" : "✗"}
                      </span>
                      <span className="truncate">{leg.question}</span>
                    </span>
                    <span
                      className={
                        "shrink-0 pl-2 text-xs " +
                        (leg.hit ? "text-win" : "text-loss")
                      }
                    >
                      {leg.correctLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Outcome payoff (after the reveal completes) */}
            {phase === "outcome" && (
              <div
                className={
                  "mt-5 text-center " +
                  (kind === "win"
                    ? "practice-win-slam"
                    : kind === "nearmiss"
                      ? "practice-nearmiss"
                      : "practice-loss")
                }
              >
                {/* Coin burst on a win — tight outward pop from the headline */}
                {kind === "win" && (
                  <div className="pointer-events-none relative">
                    <div className="absolute inset-x-0 -top-1 flex justify-center">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span
                          key={i}
                          className="practice-burst absolute text-2xl"
                          style={
                            {
                              "--dx": `${(Math.cos((i / 12) * 6.28) * 140).toFixed(0)}px`,
                              "--dy": `${(Math.sin((i / 12) * 6.28) * 140).toFixed(0)}px`,
                              animationDelay: `${i * 16}ms`,
                            } as React.CSSProperties
                          }
                        >
                          🪙
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
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

                  {/* "SO CLOSE" stamp slams over a near-miss */}
                  {kind === "nearmiss" && (
                    <span className="practice-stamp pointer-events-none absolute -right-1 -top-3 rounded border-2 border-loss px-2 py-0.5 text-xs font-black uppercase tracking-wider text-loss">
                      So close
                    </span>
                  )}
                </div>

                <p
                  className={
                    "mt-3 text-4xl font-extrabold tabular-nums " +
                    (result.net >= 0 ? "text-win" : "text-loss") +
                    (countDone ? " practice-count-slam" : "")
                  }
                >
                  {result.net >= 0 ? "+" : ""}
                  {shown}
                  <span className="ml-1 text-base font-medium text-muted">
                    coins
                  </span>
                </p>

                {/* Spot race payoff — the spot you beat the bots to boosted your score */}
                {result.won && result.spot != null && result.spotBonus > 1 && (
                  <p className="practice-spot-claim mt-3 inline-block rounded-full border border-live/50 bg-[rgba(245,166,35,0.12)] px-3 py-1 text-sm font-bold text-live">
                    ⭐ Spot #{result.spot} · +
                    {Math.round((result.spotBonus - 1) * 100)}% score bonus
                  </p>
                )}

                {result.won && result.streak > 1 && (
                  <p
                    className="practice-streak mt-3 inline-block text-sm font-bold text-accent"
                    style={{ "--pulse": streakPulse } as React.CSSProperties}
                  >
                    {flames} {result.streak} win streak!
                  </p>
                )}

                {nextError && (
                  <p className="mt-3 text-sm text-loss">{nextError}</p>
                )}

                <Button
                  variant="accent"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={nextPending}
                  onClick={onNextRound}
                >
                  {nextPending
                    ? "Dealing next round…"
                    : kind === "win"
                      ? "Next round →"
                      : "Run it back →"}
                </Button>
                <button
                  type="button"
                  className="mt-2 w-full text-sm text-muted hover:text-foreground"
                  onClick={onContinue}
                >
                  See results &amp; leaderboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
