"use client";

import { Button } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { categoryTint } from "@/lib/practice/tints";

/**
 * ARENA step 1 — MULTI-select categories. Chips are category-tinted (information,
 * not brand orange); the primary "Continue" is the one orange action here.
 */
export function CategorySelect({
  selected,
  onToggle,
  onContinue,
}: {
  selected: Set<string>;
  onToggle: (name: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Build your round</h1>
        <p className="text-sm text-muted">
          Pick the categories you want in play — you can choose as many as you
          like. Next you&apos;ll stack the slates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = selected.has(c.name);
          const tint = categoryTint(c.name);
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => onToggle(c.name)}
              aria-pressed={on}
              className="rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95"
              style={
                on
                  ? {
                      borderColor: tint.border,
                      backgroundColor: tint.soft,
                      color: tint.color,
                    }
                  : { borderColor: "#1E2A38", color: "#6B7A8E" }
              }
            >
              <span aria-hidden>{c.icon}</span> {c.name}
              {on && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>

      <Button
        variant="accent"
        size="lg"
        disabled={selected.size === 0}
        onClick={onContinue}
      >
        {selected.size === 0
          ? "Pick at least one category"
          : `Continue with ${selected.size} categor${selected.size === 1 ? "y" : "ies"} →`}
      </Button>
    </div>
  );
}
