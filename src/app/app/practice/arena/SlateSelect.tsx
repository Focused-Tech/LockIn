"use client";

import { Button } from "@/components/ui";
import { AiBadge } from "@/components/practice/AiBadge";
import { categoryTint, playstyleTint } from "@/lib/practice/tints";
import type { ArenaSlatePreview } from "@/lib/practice/arena";

/**
 * ARENA step 2 — pick MULTIPLE slates. Each slate card has a checkbox and a
 * CATEGORY-tinted outline; a persistent "Add to round" bar at the bottom shows
 * the count and confirms. On confirm the round is committed (played in event-time
 * order). Bar is the one green (money/play) primary; outlines carry information.
 */
export function SlateSelect({
  previews,
  selected,
  maxSlates,
  onToggle,
  onConfirm,
  onBack,
}: {
  previews: ArenaSlatePreview[];
  selected: Set<string>;
  maxSlates: number;
  onToggle: (key: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const atMax = selected.size >= maxSlates;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Categories
        </button>
        <h1 className="mt-1 text-xl font-semibold">Stack your slates</h1>
        <p className="text-sm text-muted">
          Add the slates you want to play. You&apos;ll play through them
          back-to-back in event-time order, then reveal them all at the end.
          {" "}
          <span className="text-foreground">Up to {maxSlates} per round.</span>
        </p>
      </div>

      {previews.length === 0 ? (
        <p className="rounded border border-border bg-surface-card px-4 py-6 text-center text-sm text-muted">
          No slates for those categories yet — go back and pick a few more.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {previews.map((p) => {
            const on = selected.has(p.key);
            const cat = categoryTint(p.category);
            const style = playstyleTint(p.difficulty);
            const disabled = !on && atMax;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onToggle(p.key)}
                disabled={disabled}
                aria-pressed={on}
                className={
                  "flex items-center gap-3 rounded-xl border border-l-4 p-3 text-left transition active:scale-[0.99] disabled:opacity-40 " +
                  (on ? "" : "hover:bg-surface-card")
                }
                style={{
                  borderColor: on ? cat.border : "#1E2A38",
                  borderLeftColor: cat.color,
                  backgroundColor: on ? cat.soft : undefined,
                }}
              >
                {/* Checkbox */}
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold"
                  style={{
                    borderColor: on ? cat.color : "#1E2A38",
                    backgroundColor: on ? cat.color : "transparent",
                    color: on ? "#0A0D12" : "transparent",
                  }}
                >
                  ✓
                </span>

                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                  style={{
                    backgroundColor: `${p.accent}1F`,
                    border: `1px solid ${p.accent}66`,
                  }}
                >
                  {p.avatar}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {p.creatorName}
                    </span>
                    <AiBadge />
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className="rounded-full px-1.5 py-0.5 font-medium"
                      style={{ backgroundColor: cat.soft, color: cat.color }}
                    >
                      {p.category}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 font-medium"
                      style={{ backgroundColor: style.soft, color: style.color }}
                    >
                      {p.difficulty}
                    </span>
                    <span className="text-muted">
                      {p.legCount} legs · event {p.eventLabel}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Persistent "Add to round" bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[rgba(10,13,18,0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 p-4">
          <span className="text-sm">
            <span className="font-semibold text-foreground">
              {selected.size}
            </span>{" "}
            <span className="text-muted">
              slate{selected.size === 1 ? "" : "s"} in round
              {atMax ? " · max" : ""}
            </span>
          </span>
          <Button
            variant="win"
            size="lg"
            disabled={selected.size === 0}
            onClick={onConfirm}
          >
            {selected.size === 0 ? "Add slates to start" : "Lock in round →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
