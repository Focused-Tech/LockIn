"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { AiBadge } from "@/components/practice/AiBadge";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { categoryTint } from "@/lib/practice/tints";
import { playReveal, playSound } from "@/lib/practice/sound";
import { ARENA, type ArenaPlayed } from "@/lib/practice/arena";

const WIN_FILL = "border-[rgba(34,197,94,0.45)] bg-[rgba(34,197,94,0.12)]";
const LOSS_FILL = "border-[rgba(232,84,84,0.45)] bg-[rgba(232,84,84,0.12)]";

/**
 * ARENA step 4 — BATCHED reveal. After every slate is played, reveal them in
 * event-time order (`played` arrives pre-sorted). Each reveal opens with a
 * suspense countdown ("Revealing in 3… 2… 1"), then lands leg-by-leg, then holds
 * on the slate result before the next. A single consolidated payout closes it.
 */
export function ArenaReveal({
  played,
  onReplay,
  onExit,
  replayPending,
}: {
  played: ArenaPlayed[];
  onReplay: () => void;
  onExit: () => void;
  replayPending: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"suspense" | "reveal">("suspense");
  const [tick, setTick] = useState<number>(ARENA.revealSuspenseTicks);
  const [landed, setLanded] = useState(0);
  const [payout, setPayout] = useState(false);

  const current = played[index];

  // Suspense countdown → then hand off to the leg reveal.
  useEffect(() => {
    if (payout || phase !== "suspense" || !current) return;
    setTick(ARENA.revealSuspenseTicks);
    setLanded(0);
    const per = ARENA.revealSuspenseMs / ARENA.revealSuspenseTicks;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let t = 1; t < ARENA.revealSuspenseTicks; t++) {
      timers.push(
        setTimeout(() => {
          setTick(ARENA.revealSuspenseTicks - t);
          playSound("locking");
        }, t * per),
      );
    }
    timers.push(setTimeout(() => setPhase("reveal"), ARENA.revealSuspenseTicks * per));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, payout]);

  // Leg-by-leg reveal → hold on the result → advance (or finish to payout).
  useEffect(() => {
    if (payout || phase !== "reveal" || !current) return;
    const n = current.legs.length;
    const beat = Math.min(
      PRACTICE_CONFIG.audio.revealBeatMs,
      Math.floor(PRACTICE_CONFIG.audio.revealMaxTotalMs / Math.max(1, n)),
    );
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < n; i++) {
      timers.push(
        setTimeout(() => {
          setLanded(i + 1);
          playReveal(i);
        }, i * beat),
      );
    }
    timers.push(
      setTimeout(() => {
        playSound(current.won ? "win" : "loss");
      }, n * beat + 120),
    );
    timers.push(
      setTimeout(() => {
        if (index + 1 >= played.length) setPayout(true);
        else {
          setIndex(index + 1);
          setPhase("suspense");
        }
      }, n * beat + 1500),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, payout]);

  if (payout) {
    const totalNet = played.reduce((s, p) => s + p.net, 0);
    const wins = played.filter((p) => p.won).length;
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Round complete
          </p>
          <p
            className={
              "mt-1 text-4xl font-extrabold tabular-nums " +
              (totalNet >= 0 ? "text-win" : "text-loss")
            }
          >
            {totalNet >= 0 ? "+" : ""}
            {totalNet}
            <span className="ml-1 text-base font-medium text-muted">coins</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {wins} of {played.length} slate{played.length === 1 ? "" : "s"} won ·
            play-money score
          </p>
        </div>

        <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
          {played.map((p) => {
            const cat = categoryTint(p.preview.category);
            return (
              <li
                key={p.preview.key}
                className="flex items-center justify-between border-l-4 bg-surface-card px-4 py-2.5"
                style={{ borderLeftColor: cat.color }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden>{p.preview.avatar}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.preview.creatorName}
                    </span>
                    <span className="block text-xs text-muted">
                      {p.preview.category} ·{" "}
                      {p.source === "skipped"
                        ? "not staked"
                        : `${p.correct}/${p.legs.length} correct`}
                    </span>
                  </span>
                </span>
                <span
                  className={
                    "shrink-0 text-sm font-semibold tabular-nums " +
                    (p.net > 0
                      ? "text-win"
                      : p.net < 0
                        ? "text-loss"
                        : "text-muted")
                  }
                >
                  {p.net >= 0 ? "+" : ""}
                  {p.net}
                </span>
              </li>
            );
          })}
        </ul>

        <Button
          variant="win"
          size="lg"
          disabled={replayPending}
          onClick={onReplay}
        >
          {replayPending ? "Building next round…" : "Play another round →"}
        </Button>
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-muted hover:text-foreground"
        >
          Back to arena
        </button>
      </div>
    );
  }

  if (!current) return null;
  const cat = categoryTint(current.preview.category);

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Reveal {index + 1} of {played.length} · event-time order
        </span>
        <span>event {current.preview.eventLabel}</span>
      </div>

      <div
        className="flex items-center gap-2 rounded-xl border border-l-4 bg-surface-card p-3"
        style={{ borderColor: cat.border, borderLeftColor: cat.color }}
      >
        <span aria-hidden className="text-lg">
          {current.preview.avatar}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {current.preview.creatorName}
          <AiBadge />
        </span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: cat.soft, color: cat.color }}
        >
          {current.preview.category}
        </span>
      </div>

      {phase === "suspense" ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-card py-12">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Revealing in
          </p>
          <p
            key={tick}
            className="arena-tick text-6xl font-extrabold tabular-nums text-accent"
            style={{ "--tick": `${ARENA.revealSuspenseMs / ARENA.revealSuspenseTicks}ms` } as React.CSSProperties}
          >
            {tick}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-5">
          <div className="flex flex-col gap-1.5">
            {current.legs.map((l, i) => {
              const isLanded = i < landed;
              const hit = current.hits[i];
              if (!isLanded) {
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm opacity-40"
                  >
                    <span className="truncate text-muted">{l.question}</span>
                    <span className="text-muted">•••</span>
                  </div>
                );
              }
              return (
                <div
                  key={l.id}
                  className={
                    "practice-leg-land flex items-center justify-between rounded border px-3 py-2 text-sm " +
                    (hit ? WIN_FILL : LOSS_FILL)
                  }
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={hit ? "text-win" : "text-loss"}>
                      {hit ? "✓" : "✗"}
                    </span>
                    <span className="truncate">{l.question}</span>
                  </span>
                  <span
                    className={
                      "shrink-0 pl-2 text-xs " + (hit ? "text-win" : "text-loss")
                    }
                  >
                    {l.options[current.outcomes[i]!]?.label ?? ""}
                  </span>
                </div>
              );
            })}
          </div>

          {landed >= current.legs.length && (
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold">
                {current.correct}/{current.legs.length} correct
              </span>
              <span
                className={
                  "text-lg font-bold tabular-nums " +
                  (current.net >= 0 ? "text-win" : "text-loss")
                }
              >
                {current.net >= 0 ? "+" : ""}
                {current.net}
                <span className="ml-1 text-xs font-medium text-muted">coins</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
