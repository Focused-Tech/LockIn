"use client";

import { useState } from "react";
import { LockGlyph } from "@/components/practice/LockGlyph";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { categoryTint } from "@/lib/practice/tints";
import { ARCHETYPE_TAG } from "@/lib/practice/generate";
import { playSound, playLegAdded } from "@/lib/practice/sound";
import type { Choice } from "@/lib/practice/scoring";
import type { PracticeLeg, PracticeOption } from "@/lib/firebase/types";

/** Duration of the swipe-away — must match `leg-swipe-away` in globals.css. */
const SWIPE_MS = 360;

/**
 * SHARED leg picker. Legs scroll as a normal list; picking an OPTION SWIPES the leg
 * card off to the right while a LockGlyph snaps shut over it (unlocked → locked),
 * then the leg drops into a compact "Locked" summary. Reduced-motion users get a
 * plain fade (handled in globals.css). Used by both the single-slate contest view
 * and the Arena's sequential play.
 *
 * §2 — options are FULL-WIDTH ROWS (2..N), one per line: name + consensus % on line
 * one, per-option context on line two, and a thin consensus meter pinned to the row's
 * bottom edge. Selecting a row recolours it to the category, dims the others, and pops
 * a lock badge before the existing swipe fires.
 *
 * Controlled-ish: it owns the swipe animation + summary, and reports the full picks
 * map (leg id → chosen option index) up via `onChange` so the parent drives lock-in.
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

  const pick = (leg: PracticeLeg, optionIndex: Choice) => {
    if (disabled || picks[leg.id] != null) return;
    const nextCount = Object.keys(picks).length + 1;
    const next = { ...picks, [leg.id]: optionIndex };
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
            const label = l.options[picks[l.id]!]?.label ?? "";
            return (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-[rgba(34,197,94,0.30)] bg-[rgba(34,197,94,0.08)] px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <LockGlyph size={15} />
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

      {/* Active leg cards — pick an option to lock + swipe it away. */}
      {active.map((l, i) => {
        const dc = PRACTICE_CONFIG.legColors[l.difficulty];
        const isSwiping = swiping.has(l.id);
        const chosen = picks[l.id];
        return (
          <div
            key={l.id}
            className={
              "relative flex flex-col rounded-lg border border-l-4 p-3 " +
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

            {/* CARD HEAD — leg number · archetype tag · difficulty pill (right). */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-muted">{legs.indexOf(l) + 1}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                {ARCHETYPE_TAG[l.archetype] ?? l.archetype}
              </span>
              <span
                className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ backgroundColor: dc.bg, color: dc.color }}
              >
                {dc.label}
              </span>
            </div>

            {/* QUESTION. */}
            <p className="mt-[11px] text-[17px] font-semibold leading-[1.38] text-white">
              {l.question}
            </p>
            {/* Milestone & duo legs carry their names/context on a leg sub-line. */}
            {l.sub && (
              <p className="mt-1 text-[11.5px] leading-[1.45] text-[#6B7A8E]">{l.sub}</p>
            )}

            {/* OPTION ROWS. */}
            <div className="mt-[13px] flex flex-col gap-2">
              {l.options.map((opt, idx) => (
                <OptionRow
                  key={idx}
                  option={opt}
                  selected={chosen === idx}
                  dimmed={chosen != null && chosen !== idx}
                  tint={tint}
                  disabled={disabled || picks[l.id] != null}
                  onPick={() => pick(l, idx)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One full-width option row: name + consensus % (line 1), context (line 2), and a
 *  thin consensus meter on the bottom edge. Selecting recolours + pops a lock badge. */
function OptionRow({
  option,
  selected,
  dimmed,
  tint,
  disabled,
  onPick,
}: {
  option: PracticeOption;
  selected: boolean;
  dimmed: boolean;
  tint: { color: string; soft: string; border: string };
  disabled: boolean;
  onPick: () => void;
}) {
  const ctx = [option.context.gameLine, option.context.seasonAvg, option.context.lastOut].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      disabled={disabled}
      data-option
      className={
        "relative w-full overflow-hidden rounded-[12px] border px-3 pb-3 pt-[11px] text-left transition-opacity duration-150 " +
        (selected ? "" : "border-border bg-surface") +
        (dimmed ? " opacity-40" : "")
      }
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.035)",
        ...(selected
          ? { borderColor: tint.color, backgroundColor: withAlpha(tint.color, 0.09) }
          : {}),
      }}
    >
      {/* LINE 1 — name (left) + consensus % (right). */}
      <span className="flex items-baseline justify-between gap-[10px]">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
          {option.label}
        </span>
        <span
          className="shrink-0 text-[13px] font-bold tabular-nums"
          style={selected ? { color: tint.color } : undefined}
        >
          {option.prob}%
        </span>
      </span>

      {/* LINE 2 — context: game line · season average · last-out (numbers step up). */}
      {ctx.length > 0 && (
        <span className="mt-[4px] block text-[11.5px] leading-[1.45] text-[#6B7A8E]">
          {ctx.map((c, i) => (
            <span key={i}>
              {i > 0 && <span> · </span>}
              {/* the numeric context values step UP one shade so they read first */}
              <span className={/\d/.test(c) ? "text-muted" : undefined}>{c}</span>
            </span>
          ))}
        </span>
      )}

      {/* CONSENSUS METER — 2.5px fill on the bottom edge, width = the %. */}
      <span
        aria-hidden
        data-meter
        className="absolute bottom-0 left-0 h-[2.5px] rounded-r-full"
        style={{
          width: `${option.prob}%`,
          backgroundColor: withAlpha(tint.color, selected ? 0.9 : 0.42),
        }}
      />

      {/* SELECTED — a 22px circular lock badge springs in at the right. */}
      {selected && (
        <span
          className="opt-lock-pop absolute right-2 top-1/2 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full"
          style={{ backgroundColor: withAlpha(tint.color, 0.16), color: tint.color }}
          aria-hidden
        >
          <LockGlyph size={13} />
        </span>
      )}
    </button>
  );
}

/** #RRGGBB → rgba() at the given alpha (tint colours are always solid hex). */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
