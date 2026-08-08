"use client";

import type { ChampionshipChip } from "@/lib/championship/copy";

/**
 * CHIP DOCK — one horizontal row of question chips in its own frame, docked at the BOTTOM EDGE of the
 * desk image (below the image, above the transcript). Gesture horizontal scroll, NO scrollbar (global
 * rule), chips NEVER wrap and never form a second row (nowrap + shrink-0 + overflow-x). Tapping a chip
 * sends its question. Chip copy is DATA (the championship copy store) — no hardcoded strings here.
 * The dock is always rendered, so it persists when the desk image is minimized.
 */
export function ChipDock({
  chips,
  onPick,
}: {
  chips: ChampionshipChip[];
  onPick: (chip: ChampionshipChip) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="z-10 shrink-0 border-b border-white/10 bg-surface-card px-3 py-2">
      <div className="flex flex-nowrap gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px] font-medium text-foreground active:opacity-70"
          >
            {c.q}
          </button>
        ))}
      </div>
    </div>
  );
}
