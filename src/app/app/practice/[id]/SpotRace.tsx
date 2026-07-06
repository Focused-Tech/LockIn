"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/practice/AiBadge";
import { LockAnimation } from "@/components/LockAnimation";
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

  // FIX 2: transient "lock in now" nudge — non-blocking, ~2s, auto-dismiss.
  const [nudge, setNudge] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedTimeout = useRef(false);
  const fireNudge = useCallback(() => {
    setNudge(true);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(false), 2000);
  }, []);
  // (b) a short delay after switching to a new slate (seed changes).
  useEffect(() => {
    firedTimeout.current = false;
    setShowLock(false);
    const t = setTimeout(fireNudge, 1200);
    return () => clearTimeout(t);
  }, [seed, fireNudge]);
  // (a) when the spots-locking counter times out: nudge + the lock slams shut.
  useEffect(() => {
    if (now != null && now >= lockAt && !firedTimeout.current) {
      firedTimeout.current = true;
      fireNudge();
      setShowLock(true);
    }
  }, [now, lockAt, fireNudge]);

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

  // Bots that have locked in so far — newest first. Each mounts once (keyed by
  // spot), so a fresh bot "enters → flashes → collapses" into the running list.
  const lockedInBots = schedule.filter(({ spot }) => spot <= filled).reverse();

  return (
    <>
      {nudge && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="rounded-full border border-live/40 bg-[rgba(20,15,4,0.95)] px-4 py-2 text-sm font-semibold text-live shadow-lg backdrop-blur">
            Top spots are filling fast — Lock in now!
          </div>
        </div>
      )}

      {showLock && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <LockAnimation size={128} onDone={() => setShowLock(false)} />
        </div>
      )}

      {/* PINNED timer bar — stays at the top of the screen while the slate scrolls
          underneath it. Solid background so content passes cleanly below. */}
      <div
        className={
          "sticky top-0 z-30 -mx-6 flex items-center justify-between border-b px-6 py-2.5 backdrop-blur " +
          (urgent
            ? "border-live/50 bg-[rgba(20,15,4,0.92)]"
            : "border-border bg-[rgba(10,13,18,0.92)]")
        }
      >
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          {locked ? "Spots locked" : "Spots locking"}
        </span>
        <span className="flex items-center gap-1.5 text-sm">
          <ClockRing frac={frac} urgent={urgent} />
          <span className="text-muted">locks in</span>
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

      {/* The race — a compact "your spot" call-out + a running list of bots that
          have filled up the premium spots. No longer a tall stack of slots. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-3">
        {best ? (
          <div className="practice-spot-open flex items-center justify-between rounded-lg border border-accent-border bg-accent-soft px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-accent">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold">
                {best}
              </span>
              Lock in now → claim spot #{best}
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
            All top spots gone — lock in for the board. Next round, be quicker.
          </div>
        )}

        {lockedInBots.length > 0 && (
          <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto">
            {lockedInBots.map(({ spot, mock }) => (
              <li
                key={spot}
                className="bot-row practice-deal bot-flash flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2 text-muted">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-card text-[11px] font-bold text-muted">
                    {spot}
                  </span>
                  <span aria-hidden>{mock.avatar}</span>
                  <span className="font-medium">{mock.name}</span>
                  <AiBadge />
                  <span className="text-xs">locked in</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted">
          {best
            ? "Training bots are claiming the premium spots — lock in before yours goes."
            : "Training bots took the premium spots this round."}
        </p>
      </div>
    </>
  );
}

/**
 * FIX 1: circular clock RING that fills empty → full as the countdown runs out
 * (driven by `frac`, the elapsed fraction 0→1 of the same countdown). Replaces
 * the old ⏳ hourglass emoji; the digital "0:48" readout stays next to it.
 */
function ClockRing({ frac, urgent }: { frac: number; urgent: boolean }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, frac));
  return (
    <span
      aria-hidden
      className={"inline-flex " + (urgent ? "text-live" : "text-foreground")}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" className="block">
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={2.5}
        />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - filled)}
          transform="rotate(-90 8 8)"
        />
      </svg>
    </span>
  );
}
