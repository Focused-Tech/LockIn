"use client";

import { useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/practice/AiBadge";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { playSound } from "@/lib/practice/sound";
import {
  elapsedFrac,
  spotsFilledAt,
  bestAvailableSpot,
  fillSchedule,
} from "@/lib/practice/urgency";

const U = PRACTICE_CONFIG.urgency;

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * COUNTDOWN + SPOT RACE. A live clock ticks toward lock and quickens near zero
 * (reusing the "locking soon" pulse + tick hook). LABELED mock players (training
 * bots) claim the top spots one at a time as it winds down, so hesitating costs
 * good spots. The best spot still open is what the player claims if they lock in
 * now — and it scales their SCORE payout (see PRACTICE_CONFIG.urgency.spotBonus).
 */
export function SpotRace({
  startAt,
  lockAt,
  seed,
}: {
  startAt: number;
  lockAt: number;
  seed: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const lastFilled = useRef(0);
  const lastTickSec = useRef(-1);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const schedule = fillSchedule(seed);

  // Drive the SFX hooks off the live clock (after mount).
  useEffect(() => {
    if (now == null) return;
    const frac = elapsedFrac(startAt, lockAt, now);
    const filled = spotsFilledAt(frac);
    if (filled > lastFilled.current) {
      lastFilled.current = filled;
      playSound("seal"); // a spot just snapped shut
    }
    const remaining = lockAt - now;
    if (remaining > 0 && remaining < U.urgentMs) {
      const sec = Math.ceil(remaining / U.tickEveryMs);
      if (sec !== lastTickSec.current) {
        lastTickSec.current = sec;
        playSound("locking"); // quickening urgency tick
      }
    }
  }, [now, startAt, lockAt]);

  if (now == null) return null; // avoid SSR drift

  const remaining = Math.max(0, lockAt - now);
  const frac = elapsedFrac(startAt, lockAt, now);
  const filled = spotsFilledAt(frac);
  const best = bestAvailableSpot(filled);
  const urgent = remaining > 0 && remaining < U.urgentMs;
  const locked = remaining <= 0;

  // Pulse quickens as the clock approaches zero.
  const pulse = urgent
    ? (
        U.pulseFastMs / 1000 +
        (remaining / U.urgentMs) * ((U.pulseSlowMs - U.pulseFastMs) / 1000)
      ).toFixed(2)
    : null;

  return (
    <div
      className={
        "flex flex-col gap-2.5 rounded-xl border p-3 " +
        (urgent
          ? "border-live/60 bg-[rgba(245,166,35,0.08)]"
          : "border-border bg-surface-card")
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          {locked ? "Spots locked" : "Top spots filling"}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-muted">⏳ locks in</span>
          {pulse ? (
            <span
              className="practice-lock-pulse inline-block font-bold tabular-nums text-live"
              style={{ "--pulse": `${pulse}s` } as React.CSSProperties}
            >
              {fmt(remaining)}
            </span>
          ) : (
            <span className="font-bold tabular-nums text-foreground">
              {fmt(remaining)}
            </span>
          )}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {schedule.map(({ spot, mock }) => {
          const isFilled = spot <= filled;
          const isYours = spot === best;
          return (
            <li
              key={spot}
              className={
                "flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors " +
                (isFilled
                  ? "border-border bg-surface opacity-70"
                  : isYours
                    ? "practice-spot-open border-accent-border bg-accent-soft"
                    : "border-border bg-surface")
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold " +
                    (isFilled
                      ? "bg-surface-card text-muted"
                      : "bg-accent-soft text-accent")
                  }
                >
                  {spot}
                </span>
                {isFilled ? (
                  <span className="flex items-center gap-1.5 text-muted">
                    <span aria-hidden>{mock.avatar}</span>
                    <span className="font-medium">{mock.name}</span>
                    <AiBadge />
                    <span className="text-xs">locked in</span>
                  </span>
                ) : isYours ? (
                  <span className="font-semibold text-accent">
                    Open — lock in now to claim it
                  </span>
                ) : (
                  <span className="text-muted">Open</span>
                )}
              </span>
              <span
                className={
                  "shrink-0 text-xs font-semibold " +
                  (isFilled ? "text-muted" : "text-accent")
                }
              >
                +{Math.round(((U.spotBonus[spot - 1] ?? 1) - 1) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-muted">
        {best
          ? `Lock in now → you take spot #${best} (+${Math.round(
              ((U.spotBonus[best - 1] ?? 1) - 1) * 100,
            )}% score bonus). Training bots take the rest.`
          : "All top spots are gone — lock in for the board. Next round, be quicker."}
      </p>
    </div>
  );
}
