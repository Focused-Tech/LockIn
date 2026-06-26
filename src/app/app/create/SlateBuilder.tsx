"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { ENTRY_TIERS, type EntryTier } from "@/lib/constants";
import type { Category } from "@/lib/categories";
import { createSlate, suggestOdds } from "./actions";

type PredType = "binary" | "over_under";

interface PredForm {
  id: number;
  type: PredType;
  question: string;
  optionA: string;
  optionB: string;
  line: string;
  probA: string; // probB is derived as 100 - probA
}

const DEFAULT_HOSTING_DOLLARS: Record<EntryTier, string> = {
  5: "1.00",
  10: "2.00",
  25: "3.00",
};

function blankPrediction(id: number): PredForm {
  return {
    id,
    type: "binary",
    question: "",
    optionA: "",
    optionB: "",
    line: "",
    probA: "50",
  };
}

export function SlateBuilder({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const nextId = useRef(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [lockTime, setLockTime] = useState("");
  const [predictions, setPredictions] = useState<PredForm[]>([
    blankPrediction(0),
  ]);
  const [tiers, setTiers] = useState<
    Record<EntryTier, { enabled: boolean; fee: string }>
  >({
    5: { enabled: true, fee: DEFAULT_HOSTING_DOLLARS[5] },
    10: { enabled: false, fee: DEFAULT_HOSTING_DOLLARS[10] },
    25: { enabled: false, fee: DEFAULT_HOSTING_DOLLARS[25] },
  });
  const [cardRush, setCardRush] = useState(false);
  const [rushMult, setRushMult] = useState<2 | 3>(2);
  const [maxEntries, setMaxEntries] = useState("");

  const updatePred = (id: number, patch: Partial<PredForm>) =>
    setPredictions((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addPrediction = () =>
    setPredictions((ps) => [...ps, blankPrediction(nextId.current++)]);

  const removePrediction = (id: number) =>
    setPredictions((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== id) : ps));

  function getOdds(p: PredForm) {
    startTransition(async () => {
      const optionA = p.type === "over_under" ? `Over ${p.line || "?"}` : p.optionA;
      const optionB = p.type === "over_under" ? `Under ${p.line || "?"}` : p.optionB;
      const odds = await suggestOdds({
        question: p.question,
        optionA,
        optionB,
      });
      updatePred(p.id, { probA: String(odds.probA) });
    });
  }

  function onSubmit() {
    setError(null);

    const selectedTiers = (Object.keys(tiers) as unknown as EntryTier[])
      .map((t) => Number(t) as EntryTier)
      .filter((t) => tiers[t].enabled)
      .map((t) => ({
        tier: t,
        hostingFeeCents: Math.round((parseFloat(tiers[t].fee) || 0) * 100),
      }));

    if (selectedTiers.length === 0) {
      setError("Enable at least one entry tier");
      return;
    }

    const lockTimeMs = lockTime ? new Date(lockTime).getTime() : 0;
    if (!lockTimeMs || lockTimeMs <= Date.now()) {
      setError("Set a lock time in the future");
      return;
    }

    const builtPredictions = predictions.map((p) => {
      const probA = parseInt(p.probA, 10) || 0;
      const line = p.type === "over_under" ? parseFloat(p.line) : NaN;
      return {
        type: p.type,
        question: p.question.trim(),
        optionA:
          p.type === "over_under" ? `Over ${p.line}` : p.optionA.trim(),
        optionB:
          p.type === "over_under" ? `Under ${p.line}` : p.optionB.trim(),
        line: Number.isFinite(line) ? line : null,
        probA,
        probB: 100 - probA,
      };
    });

    startTransition(async () => {
      const result = await createSlate({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        lockTimeMs,
        predictions: builtPredictions,
        tiers: selectedTiers,
        cardRush,
        rushMultiplier: cardRush ? rushMult : undefined,
        maxEntries:
          cardRush && maxEntries ? parseInt(maxEntries, 10) || null : null,
      });
      if (result.ok) router.push(`/app/slate/${result.slateId}`);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Slate basics */}
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Daytona 500 — Final Lap Showdown"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Category</span>
            <Select value={category} onChange={setCategory}>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Lock time</span>
            <Input
              type="datetime-local"
              value={lockTime}
              onChange={(e) => setLockTime(e.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Description (optional)</span>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who takes the checkered flag?"
          />
        </label>
      </Card>

      {/* Predictions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Predictions</h2>
          <Button variant="ghost" size="sm" onClick={addPrediction}>
            + Add
          </Button>
        </div>

        {predictions.map((p, i) => (
          <Card key={p.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Question {i + 1}</span>
              {predictions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePrediction(p.id)}
                  className="text-xs text-muted hover:text-loss"
                >
                  Remove
                </button>
              )}
            </div>

            <Select
              value={p.type}
              onChange={(v) => updatePred(p.id, { type: v as PredType })}
            >
              <option value="binary">Binary (A vs B)</option>
              <option value="over_under">Over / Under</option>
            </Select>

            <Input
              value={p.question}
              onChange={(e) => updatePred(p.id, { question: e.target.value })}
              placeholder="Who finishes higher?"
            />

            {p.type === "binary" ? (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={p.optionA}
                  onChange={(e) => updatePred(p.id, { optionA: e.target.value })}
                  placeholder="Option A"
                />
                <Input
                  value={p.optionB}
                  onChange={(e) => updatePred(p.id, { optionB: e.target.value })}
                  placeholder="Option B"
                />
              </div>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-muted">Line</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={p.line}
                  onChange={(e) => updatePred(p.id, { line: e.target.value })}
                  placeholder="220.5"
                />
              </label>
            )}

            {/* AI odds (accept / override) */}
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs text-muted">
                  {p.type === "over_under" ? "Over" : "Option A"} probability (%)
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={p.probA}
                  onChange={(e) => updatePred(p.id, { probA: e.target.value })}
                />
              </label>
              <div className="pb-2.5 text-xs text-muted">
                {p.type === "over_under" ? "Under" : "Option B"}:{" "}
                {100 - (parseInt(p.probA, 10) || 0)}%
              </div>
              <Button
                variant="rush"
                size="sm"
                disabled={pending || !p.question}
                onClick={() => getOdds(p)}
              >
                AI odds
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Entry tiers */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Entry tiers & hosting fee</h2>
        {ENTRY_TIERS.map((t) => (
          <div key={t} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                className="accent-accent"
                checked={tiers[t].enabled}
                onChange={(e) =>
                  setTiers((x) => ({
                    ...x,
                    [t]: { ...x[t], enabled: e.target.checked },
                  }))
                }
              />
              <span className="font-medium">${t} entry</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              Hosting $
              <Input
                type="number"
                inputMode="decimal"
                className="h-9 w-20"
                value={tiers[t].fee}
                disabled={!tiers[t].enabled}
                onChange={(e) =>
                  setTiers((x) => ({
                    ...x,
                    [t]: { ...x[t], fee: e.target.value },
                  }))
                }
              />
            </label>
          </div>
        ))}
        <p className="text-xs text-muted">
          You keep 40% of hosting fees; LockIn takes 60%.
        </p>
      </Card>

      {/* Card Rush */}
      <Card
        className={
          "flex flex-col gap-3 " +
          (cardRush ? "border-rush-border bg-rush-soft" : "")
        }
      >
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="accent-rush"
            checked={cardRush}
            onChange={(e) => setCardRush(e.target.checked)}
          />
          <span className="font-medium text-rush">⚡ Card Rush</span>
          <span className="text-xs text-muted">
            Time-limited, boosted prizes
          </span>
        </label>

        {cardRush && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Prize multiplier</span>
              <div className="flex gap-1.5">
                {([2, 3] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setRushMult(x)}
                    className={
                      "rounded border px-2.5 py-1 text-sm transition-colors " +
                      (rushMult === x
                        ? "border-rush-border bg-rush-soft text-rush"
                        : "border-border text-muted hover:text-foreground")
                    }
                  >
                    {x}x
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Max entries (optional)</span>
              <Input
                type="number"
                inputMode="numeric"
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                placeholder="e.g. 500"
              />
            </label>
            <p className="text-xs text-muted">
              LockIn funds the {rushMult}x boost. Entries close at lock time or
              when the cap fills.
            </p>
          </>
        )}
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      <Button variant="accent" size="lg" disabled={pending} onClick={onSubmit}>
        {pending ? "Publishing…" : "Publish contest"}
      </Button>
    </div>
  );
}

/** Styled native select matching the dark theme. */
function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
    >
      {children}
    </select>
  );
}
