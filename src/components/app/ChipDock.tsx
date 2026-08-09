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
    // FRAME RECEDES — panel-toned background, a single hairline (edge token) under the row, no bright
    // outline. The PILLS carry the definition: clear border, bold label, a generous tap target.
    <div className="z-10 shrink-0 border-b border-border bg-surface-card px-3 pb-2 pt-1.5">
      <div className="flex flex-nowrap gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            className="shrink-0 whitespace-nowrap rounded-full border border-[#2c3847] bg-surface px-4 py-2 text-[13px] font-semibold text-foreground active:bg-[#1a212b]"
          >
            {c.q}
          </button>
        ))}
      </div>
    </div>
  );
}
