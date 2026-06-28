"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import type { Category } from "@/lib/categories";
import { createPracticeContest } from "../actions";

interface ManualLeg {
  question: string;
  optionA: string;
  optionB: string;
  probA: string;
}

const blankLeg = (): ManualLeg => ({
  question: "",
  optionA: "Yes",
  optionB: "No",
  probA: "55",
});

export function CreatePracticeForm({
  categories,
  tierLabel,
  legs,
}: {
  categories: Category[];
  tierLabel: string;
  legs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [topic, setTopic] = useState("");
  const [manualLegs, setManualLegs] = useState<ManualLeg[]>([
    blankLeg(),
    blankLeg(),
    blankLeg(),
  ]);

  const setLeg = (i: number, patch: Partial<ManualLeg>) =>
    setManualLegs((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPracticeContest({
        category,
        mode,
        topic: topic.trim() || undefined,
        manualLegs:
          mode === "manual"
            ? manualLegs.map((l) => ({
                question: l.question,
                optionA: l.optionA,
                optionB: l.optionB,
                probA: parseInt(l.probA, 10) || 50,
              }))
            : undefined,
      });
      if (res.ok) router.push(`/app/practice/${res.contestId}`);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* AI vs manual */}
      <div className="flex rounded-full border border-border p-0.5">
        {(["ai", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "flex-1 rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors " +
              (mode === m
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground")
            }
          >
            {m === "ai" ? "AI generate" : "Pick my own"}
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded border border-border bg-surface px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>

        {mode === "ai" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">
              Topic (optional) — AI builds {legs} legs for your {tierLabel} tier
            </span>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. tonight's NBA games"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            {manualLegs.map((l, i) => (
              <div key={i} className="flex flex-col gap-2 rounded border border-border p-2.5">
                <Input
                  value={l.question}
                  onChange={(e) => setLeg(i, { question: e.target.value })}
                  placeholder={`Question ${i + 1}`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={l.optionA}
                    onChange={(e) => setLeg(i, { optionA: e.target.value })}
                    placeholder="Option A"
                  />
                  <Input
                    value={l.optionB}
                    onChange={(e) => setLeg(i, { optionB: e.target.value })}
                    placeholder="Option B"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  A wins %
                  <Input
                    type="number"
                    className="h-8 w-20"
                    min={1}
                    max={99}
                    value={l.probA}
                    onChange={(e) => setLeg(i, { probA: e.target.value })}
                  />
                </label>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManualLegs((ls) => [...ls, blankLeg()])}
              disabled={manualLegs.length >= 8}
            >
              + Add leg
            </Button>
          </div>
        )}
      </Card>

      {error && (
        <p className="rounded border border-loss-border bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}

      <Button variant="accent" size="lg" disabled={pending} onClick={submit}>
        {pending ? "Building…" : "Host contest"}
      </Button>
    </div>
  );
}
