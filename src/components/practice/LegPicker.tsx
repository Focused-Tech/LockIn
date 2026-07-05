"use client";

import { useState } from "react";
import { LockGlyph } from "@/components/practice/LockGlyph";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { categoryTint } from "@/lib/practice/tints";
import { playSound, playLegAdded } from "@/lib/practice/sound";
import type { Choice } from "@/lib/practice/scoring";
import type { PracticeLeg } from "@/lib/firebase/types";

/** Duration of the swipe-away — must match `leg-swipe-away` in globals.css. */
const SWIPE_MS = 360;

/**
 * SHARED leg picker. Legs scroll as a normal list; picking a side SWIPES the leg
 * card off to the right while a LockGlyph snaps shut over it (unlocked → locked),
 * then the leg drops into a compact "Locked" summary. Reduced-motion users get a
 * plain fade (handled in globals.css). Used by both the single-slate contest view
 * and the Arena's sequential play.
 *
 * Controlled-ish: it owns the swipe animation + summary, and reports the full
 * picks map up via `onChange` so the parent can drive submit/lock-in.
 */
export function LegPicker({
  legs,
  category,
  onChange,
  disabled = false,
}: {
  legs: PracticeLeg[];
  /** Slate category — drives the shared category outline + selection glow. */
  category: string;
  onChange?: (picks: Record<string, Choice>) => void;
  disabled?: boolean;
}) {
  const tint = categoryTint(category);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  // Legs mid-swipe (picked, animation still running). They render as the full
  // card with the lock overlay until the timer drops them into the summary.
  const [swiping, setSwiping] = useState<Set<string>>(new Set());

  const pick = (leg: PracticeLeg, side: Choice) => {
    if (disabled || picks[leg.id] != null) return;
    const nextCount = Object.keys(picks).length + 1;
    const next = { ...picks, [leg.id]: side };
    setPicks(next);
    onChange?.(next);
    setSwiping((s) => new Set(s).add(leg.id));
    playLegAdded(nextCount); // ascending combo tick
    playSound("seal"); // the lock snapping shut
    window.setTimeout(() => {
      setSwiping((s) => {
        const n = new Set(s);
        n.delete(leg.id);
        return n;
      });
    }, SWIPE_MS);
  };

  // Full cards = legs not yet picked, plus any still swiping out.
  const active = legs.filter((l) => picks[l.id] == null || swiping.has(l.id));
  const locked = legs.filter((l) => picks[l.id] != null && !swiping.has(l.id));

  return (
    <div className="flex flex-col gap-3">
      {/* Locked-in summary — grows as legs are picked. */}
      {locked.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {locked.map((l) => {
            const side = picks[l.id]!;
            const label = side === "a" ? l.optionA : l.optionB;
            return (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-[rgba(34,197,94,0.30)] bg-[rgba(34,197,94,0.08)] px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="text-win" aria-hidden>
                    🔒
                  </span>
                  <span className="truncate text-muted">{l.question}</span>
                </span>
                <span className="shrink-0 pl-2 text-xs font-medium text-win">
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Active leg cards — pick a side to lock + swipe it away. */}
      {active.map((l, i) => {
        const dc = PRACTICE_CONFIG.legColors[l.difficulty];
        const isSwiping = swiping.has(l.id);
        return (
          <div
            key={l.id}
            className={
              "relative flex flex-col gap-2 rounded-lg border border-l-4 p-3 " +
              (isSwiping ? "leg-swiping" : "practice-deal")
            }
            style={
              {
                animationDelay: isSwiping ? undefined : `${i * 40}ms`,
                borderColor: tint.border,
                borderLeftColor: tint.color,
                "--cat": tint.color,
              } as React.CSSProperties
            }
          >
            {/* Lock glyph snaps shut over the card as it swipes away. */}
            {isSwiping && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[rgba(10,13,18,0.35)]">
                <LockGlyph size={48} />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                <span className="text-muted">
                  {legs.indexOf(l) + 1}.
                </span>{" "}
                {l.question}
              </p>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: dc.bg, color: dc.color }}
              >
                {dc.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((side) => {
                const label = side === "a" ? l.optionA : l.optionB;
                const prob = side === "a" ? l.probA : l.probB;
                const on = picks[l.id] === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => pick(l, side)}
                    aria-pressed={on}
                    disabled={disabled || picks[l.id] != null}
                    className={
                      "flex flex-col gap-0.5 rounded border px-3 py-2 text-left transition duration-100 active:scale-[0.97] " +
                      (on
                        ? "practice-pick-pop cat-pick-selected"
                        : "border-border bg-surface hover:bg-surface-card")
                    }
                    style={on ? { backgroundColor: tint.soft } : undefined}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium">{label}</span>
                      {on && (
                        <span
                          className="practice-check-pop text-sm font-bold"
                          style={{ color: tint.color }}
                          aria-hidden
                        >
                          ✓
                        </span>
                      )}
                    </span>
                    <span
                      className={"text-xs " + (on ? "" : "text-muted")}
                      style={on ? { color: tint.color } : undefined}
                    >
                      {prob}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
