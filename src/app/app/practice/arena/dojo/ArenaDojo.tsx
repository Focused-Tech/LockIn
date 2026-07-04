"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { categoryTint } from "@/lib/practice/tints";
import { createPracticeContest } from "../../actions";

/**
 * PRACTICE DOJO — single-slate warm-up vs the house AI (LockIn Fox). Pick one
 * category; we spin up an AI-hosted practice contest and drop you straight into
 * the real play surface (/app/practice/[id]). "Add another slate" graduates you
 * to Multi-Slate — the on-ramp described in the prototype.
 */
export function ArenaDojo() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    if (!category) return;
    setError(null);
    startTransition(async () => {
      // vs the house AI creator (LockIn Fox); no silent catch — surface failures.
      const res = await createPracticeContest({
        category,
        mode: "ai",
        creatorId: "ai_lockinfox",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/app/practice/${res.contestId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#5dcaa5]">
          Practice Dojo
        </span>
        <h1 className="mt-1 text-xl font-semibold">Choose a category</h1>
        <p className="text-sm text-muted">
          Single slate vs <span className="text-foreground">LockIn Fox</span>{" "}
          (AI). Coaching hints on. Add another slate to graduate to Multi-Slate.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = category === c.name;
          const tint = categoryTint(c.name);
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => setCategory(on ? null : c.name)}
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

      <button
        type="button"
        onClick={() => router.push("/app/practice/arena/multi")}
        className="rounded-xl border border-dashed border-[rgba(55,138,221,0.6)] p-3 text-sm font-semibold text-[#378add] transition active:scale-[0.98]"
      >
        + Add another slate — play Multi-Slate →
      </button>

      {error && (
        <p className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="lg"
        disabled={!category || pending}
        onClick={start}
      >
        {pending
          ? "Dealing your slate…"
          : category
            ? `Start practicing ${category} →`
            : "Pick a category"}
      </Button>
    </div>
  );
}
