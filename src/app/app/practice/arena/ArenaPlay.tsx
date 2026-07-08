"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { AiBadge } from "@/components/practice/AiBadge";
import { LegPicker } from "@/components/practice/LegPicker";
import { SpotRace } from "../[id]/SpotRace";
import { LockAnimation } from "@/components/LockAnimation";
import { SlateLockLoader } from "@/components/SlateLockLoader";
import { createPracticeContest, submitPracticePicks } from "../actions";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { PRACTICE_DEFAULT_STAKE, scorePractice, type Choice } from "@/lib/practice/scoring";
import { categoryTint } from "@/lib/practice/tints";
import { playSound } from "@/lib/practice/sound";
import {
  ARENA,
  buildLocalSlate,
  type ArenaPlayed,
  type ArenaSlatePreview,
} from "@/lib/practice/arena";
import type { PracticeLeg } from "@/lib/firebase/types";

/** A generated (or locally-built) slate ready to play. */
interface Gen {
  source: "real" | "local";
  contestId: string | null;
  legs: PracticeLeg[];
  urgency: { startAt: number; lockAt: number } | null;
  stakeCoins: number;
  /** Hidden outcomes — LOCAL fallback only (real slates settle server-side). */
  outcomes?: Choice[];
}

/** Generate a slate for a preview; fall back to a curated local slate on failure
 *  so the round always runs (e.g. when the AI engine isn't configured). */
async function genSlate(p: ArenaSlatePreview): Promise<Gen> {
  try {
    const res = await createPracticeContest({
      category: p.category,
      mode: "ai",
      creatorId: p.creatorId,
    });
    if (res.ok) {
      return {
        source: "real",
        contestId: res.contestId,
        legs: res.legs,
        urgency: res.urgency,
        stakeCoins: res.stakeCoins,
      };
    }
  } catch {
    /* fall through to local */
  }
  const { legs, outcomes } = buildLocalSlate(p);
  const now = Date.now();
  return {
    source: "local",
    contestId: null,
    legs,
    urgency: { startAt: now, lockAt: now + PRACTICE_CONFIG.urgency.countdownMs },
    stakeCoins: PRACTICE_DEFAULT_STAKE,
    outcomes,
  };
}

/**
 * ARENA step 3 — SEQUENTIAL play. Plays the committed round one slate at a time:
 * generate (lazily, with prefetch during the gap) → pick legs → lock in → a 5s
 * "next slate" countdown → repeat. Reveals are WITHHELD here; results accumulate
 * and are handed to the batched reveal via `onDone`.
 */
export function ArenaPlay({
  round,
  onDone,
}: {
  round: ArenaSlatePreview[];
  onDone: (played: ArenaPlayed[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"generating" | "picking" | "countdown">(
    "generating",
  );
  const [gen, setGen] = useState<Gen | null>(null);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lockAnim, setLockAnim] = useState(false);
  const [cdSecs, setCdSecs] = useState(0);
  const playedRef = useRef<ArenaPlayed[]>([]);
  const genCache = useRef<Map<string, Promise<Gen>>>(new Map());

  const current = round[index];

  const ensureGen = (p: ArenaSlatePreview) => {
    const c = genCache.current;
    if (!c.has(p.key)) c.set(p.key, genSlate(p));
    return c.get(p.key)!;
  };

  // Enter a slate: reset picks, resolve its generation, then let the player pick.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setPhase("generating");
    setGen(null);
    setPicks({});
    ensureGen(current).then((g) => {
      if (cancelled) return;
      setGen(g);
      setPhase("picking");
    });
    // Prefetch the next slate so its generation is hidden by this one's play.
    const next = round[index + 1];
    if (next) ensureGen(next);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Inter-slate countdown ("Next slate in Ns…"), then advance.
  useEffect(() => {
    if (phase !== "countdown") return;
    const secs = Math.round(ARENA.interSlateCountdownMs / 1000);
    setCdSecs(secs);
    let s = secs;
    const tick = setInterval(() => {
      s -= 1;
      setCdSecs(s);
      if (s <= 0) clearInterval(tick);
    }, 1000);
    const done = setTimeout(
      () => setIndex((i) => i + 1),
      ARENA.interSlateCountdownMs,
    );
    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [phase]);

  async function lockIn() {
    if (!gen || !current) return;
    setLockAnim(true); // the lock slams shut on lock-in
    setSubmitting(true);
    playSound("lockin");
    const ordered = gen.legs.map((l) => picks[l.id]!) as Choice[];

    let result: ArenaPlayed;
    if (gen.source === "real" && gen.contestId) {
      const res = await submitPracticePicks(gen.contestId, ordered);
      if (res.ok) {
        result = {
          preview: current,
          legs: gen.legs,
          picks: ordered,
          outcomes: res.outcomes,
          hits: res.hits,
          correct: res.correct,
          net: res.net,
          won: res.won,
          perfect: res.perfect,
          source: "real",
        };
      } else {
        // Couldn't stake (e.g. out of coins) — record as skipped, keep the round going.
        result = {
          preview: current,
          legs: gen.legs,
          picks: ordered,
          outcomes: gen.legs.map(() => "a" as Choice),
          hits: gen.legs.map(() => false),
          correct: 0,
          net: 0,
          won: false,
          perfect: false,
          source: "skipped",
        };
      }
    } else {
      const r = scorePractice(ordered, gen.outcomes ?? [], gen.stakeCoins);
      result = {
        preview: current,
        legs: gen.legs,
        picks: ordered,
        outcomes: gen.outcomes ?? [],
        hits: r.hits,
        correct: r.correct,
        net: r.net,
        won: r.won,
        perfect: r.perfect,
        source: "local",
      };
    }

    playedRef.current = [...playedRef.current, result];
    setSubmitting(false);

    if (index + 1 >= round.length) {
      onDone(playedRef.current);
    } else {
      setPhase("countdown");
    }
  }

  if (!current) return null;
  const cat = categoryTint(current.category);
  const allPicked = gen != null && Object.keys(picks).length === gen.legs.length;

  // Between-slate countdown.
  if (phase === "countdown") {
    const next = round[index + 1];
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        {lockAnim && (
          <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
            <LockAnimation size={128} onDone={() => setLockAnim(false)} />
          </div>
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Slate locked · next up
        </p>
        <p className="text-5xl font-extrabold tabular-nums text-win">
          {Math.max(0, cdSecs)}s
        </p>
        {next && (
          <p className="text-sm text-muted">
            {next.avatar} {next.creatorName} · {next.category} (event{" "}
            {next.eventLabel})
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {lockAnim && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <LockAnimation size={128} onDone={() => setLockAnim(false)} />
        </div>
      )}

      {/* Round progress */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Slate {index + 1} of {round.length}
        </span>
        <span>event {current.eventLabel}</span>
      </div>

      {/* Slate header */}
      <div
        className="flex items-center gap-2 rounded-xl border border-l-4 bg-surface-card p-3"
        style={{ borderColor: cat.border, borderLeftColor: cat.color }}
      >
        <span aria-hidden className="text-lg">
          {current.avatar}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {current.creatorName}
          <AiBadge />
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: cat.soft, color: cat.color }}
        >
          {current.category}
        </span>
      </div>

      {phase === "generating" || !gen ? (
        <SlateLockLoader creatorName={current.creatorName} />
      ) : (
        <>
          {/* Pinned timer + spot race (shared play surface). */}
          {gen.urgency && (
            <SpotRace
              startAt={gen.urgency.startAt}
              lockAt={gen.urgency.lockAt}
              seed={gen.contestId ?? current.key}
            />
          )}

          <LegPicker
            key={current.key}
            legs={gen.legs}
            category={current.category}
            onChange={setPicks}
            disabled={submitting}
          />

          <Button
            variant="accent"
            size="lg"
            disabled={submitting || !allPicked}
            onClick={lockIn}
          >
            {submitting
              ? "Locking in…"
              : allPicked
                ? index + 1 >= round.length
                  ? "Lock in final slate →"
                  : "Lock in slate →"
                : "Pick every leg"}
          </Button>
          <p className="text-center text-[11px] text-muted">
            Play-money — coins are score for rank &amp; bragging rights. Reveals
            run at the end, in event-time order.
          </p>
        </>
      )}
    </div>
  );
}
