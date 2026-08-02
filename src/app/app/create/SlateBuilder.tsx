"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { ENTRY_TIERS, type EntryTier } from "@/lib/constants";
import type { Category } from "@/lib/categories";
import { createSlate, suggestOdds } from "./actions";
import { ARCHETYPE_CHOICES } from "@/lib/contest/archetypeLibrary";
import type { Archetype } from "@/lib/contest/questionEngine";

type PredType = "binary" | "over_under";
type Difficulty = "easy" | "medium" | "hard";

interface PredForm {
  id: number;
  type: PredType;
  /** §4.1 — the cross-game archetype this leg is built as, chosen from the shared ARCHETYPE_CHOICES. */
  archetype: Archetype;
  question: string;
  optionA: string;
  optionB: string;
  line: string;
  probA: string; // probB is derived as 100 - probA
  /** Set when the leg came from the AI engine (display-only). */
  difficulty?: Difficulty;
  rank?: number;
}

/** Shape returned by POST /api/slate/generate (see src/lib/ai/slatePrompt.ts). */
interface GeneratedLeg {
  rank: number;
  question: string;
  type: PredType;
  optionA: string;
  optionB: string;
  overUnderLine: number | null;
  probA: number;
  probB: number;
  difficulty: Difficulty;
  rationale: string;
}
interface GeneratedSlate {
  topic: string;
  category: string;
  legs: GeneratedLeg[];
  source: "llm" | "llm+odds";
  model: string;
}

const DIFFICULTY_TONE: Record<Difficulty, string> = {
  easy: "border-win-border bg-win-soft text-win",
  medium: "border-live-border bg-live-soft text-live",
  hard: "border-loss-border bg-loss-soft text-loss",
};

const DEFAULT_HOSTING_DOLLARS: Record<EntryTier, string> = {
  5: "1.00",
  10: "2.00",
  25: "3.00",
};

function blankPrediction(id: number): PredForm {
  return {
    id,
    type: "binary",
    archetype: "cross_game_h2h",
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

  // AI-suggest (calls POST /api/slate/generate).
  const [topic, setTopic] = useState("");
  const [aiLegCount, setAiLegCount] = useState(5);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  async function aiSuggest() {
    const t = topic.trim() || title.trim();
    if (!t) {
      setAiError("Enter a topic (or a title) to generate from");
      return;
    }
    setAiError(null);
    setAiNote(null);
    setAiPending(true);
    try {
      const res = await fetch("/api/slate/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, legCount: aiLegCount }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setAiError(body.error ?? `AI request failed (${res.status})`);
        return;
      }
      const slate = (await res.json()) as GeneratedSlate;
      const rows: PredForm[] = slate.legs.map((leg) => ({
        id: nextId.current++,
        type: leg.type,
        archetype: "cross_game_h2h",
        question: leg.question,
        optionA: leg.type === "over_under" ? "" : leg.optionA,
        optionB: leg.type === "over_under" ? "" : leg.optionB,
        line:
          leg.type === "over_under" && leg.overUnderLine != null
            ? String(leg.overUnderLine)
            : "",
        probA: String(leg.probA),
        difficulty: leg.difficulty,
        rank: leg.rank,
      }));
      if (rows.length) setPredictions(rows);
      const match = categories.find(
        (c) => c.name.toLowerCase() === slate.category.toLowerCase(),
      );
      if (match) setCategory(match.name);
      setAiNote(
        `Generated ${rows.length} ranked legs · ${
          slate.source === "llm+odds" ? "odds-anchored" : "AI estimate"
        } · ${slate.model}. Review and edit before publishing.`,
      );
    } catch {
      setAiError("Network error reaching the AI engine");
    } finally {
      setAiPending(false);
    }
  }

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
        cardRush: false,
        rushMultiplier: undefined,
        maxEntries: null,
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

      {/* AI suggest — manual-first: optional, fills the legs below to edit. */}
      <Card className="flex flex-col gap-3 border-[rgba(59,139,255,0.30)] bg-[rgba(59,139,255,0.08)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ai">✨ AI suggest a slate</span>
          <span className="text-xs text-muted">optional — you stay in control</span>
        </div>
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic, e.g. NBA tonight, Premier League Saturday…"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Legs</span>
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAiLegCount(n)}
                className={
                  "rounded border px-2.5 py-1 text-sm transition-colors " +
                  (aiLegCount === n
                    ? "border-[rgba(59,139,255,0.30)] bg-[rgba(59,139,255,0.10)] text-ai"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            variant="ai"
            size="sm"
            disabled={aiPending}
            onClick={aiSuggest}
          >
            {aiPending ? "Generating…" : "Generate legs"}
          </Button>
        </div>
        {aiNote && <p className="text-xs text-ai">{aiNote}</p>}
        {aiError && <p className="text-xs text-loss">{aiError}</p>}
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
              <span className="flex items-center gap-2 text-xs text-muted">
                Question {i + 1}
                {p.difficulty && (
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize " +
                      DIFFICULTY_TONE[p.difficulty]
                    }
                  >
                    {p.rank ? `#${p.rank} · ` : ""}
                    {p.difficulty}
                  </span>
                )}
              </span>
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

            {/* §4.1 — choose any of the SIX approved cross-game archetypes, from the shared library. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Question type (cross-game archetype)</span>
              <Select
                value={p.archetype}
                onChange={(v) => updatePred(p.id, { archetype: v as Archetype })}
              >
                {ARCHETYPE_CHOICES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </label>
            {(() => {
              const choice = ARCHETYPE_CHOICES.find((c) => c.id === p.archetype);
              if (!choice) return null;
              return (
                <p className="text-xs text-muted">
                  {choice.blurb}{" "}
                  <span className="text-dim2">One player per game — drop or swap any that share a game.</span>
                </p>
              );
            })()}

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
          Enable more than one tier to open this slate as multiple entry-level
          pools — each tier is its own prize pool, settled independently. You
          keep 40% of hosting fees; LockIn takes 60%.
        </p>
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
