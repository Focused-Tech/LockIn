"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PracticeMusic } from "@/components/practice/PracticeMusic";
import {
  ARENA,
  buildSlatePreviews,
  byEventTime,
  type ArenaPlayed,
  type ArenaSlatePreview,
} from "@/lib/practice/arena";
import { CategorySelect } from "./CategorySelect";
import { SlateSelect } from "./SlateSelect";
import { ArenaPlay } from "./ArenaPlay";
import { ArenaReveal } from "./ArenaReveal";

type Step = "categories" | "slates" | "playing" | "revealing";

/**
 * ARENA — the multi-slate round orchestrator (client-only; composes the existing
 * practice server actions, no new data layer). Flow:
 *   categories (multi) → slates (multi, "Add to round") → play sequentially →
 *   batched reveal in event-time order → consolidated payout.
 */
export function ArenaSession() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("categories");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [slateKeys, setSlateKeys] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<ArenaSlatePreview[]>([]);
  const [played, setPlayed] = useState<ArenaPlayed[]>([]);
  const [, startReplay] = useTransition();

  const previews = buildSlatePreviews([...categories]);

  const toggleCategory = (name: string) =>
    setCategories((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const toggleSlate = (key: string) =>
    setSlateKeys((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else if (n.size < ARENA.maxSlates) n.add(key);
      return n;
    });

  function confirmRound() {
    const chosen = previews
      .filter((p) => slateKeys.has(p.key))
      .sort(byEventTime); // committed play + reveal order = event-time
    if (chosen.length === 0) return;

    // TODO(followers-joining): a simulated "followers of the selected creator(s)
    // are joining" animation belongs HERE — between round confirm and play —
    // showing a running participant count + pot size before the first slate opens.
    // Insert a `"joining"` step before "playing" and animate off `chosen`; nothing
    // downstream depends on going straight to "playing", so it slots in cleanly.
    setRound(chosen);
    setStep("playing");
  }

  function onPlayDone(results: ArenaPlayed[]) {
    setPlayed(results);
    setStep("revealing");
  }

  function replay() {
    startReplay(() => {
      setPlayed([]);
      setRound([]);
      setSlateKeys(new Set());
      setStep("slates"); // keep their categories; re-stack a fresh round
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PracticeMusic track="multiplayer" />

      {step === "categories" && (
        <CategorySelect
          selected={categories}
          onToggle={toggleCategory}
          onContinue={() => setStep("slates")}
        />
      )}

      {step === "slates" && (
        <SlateSelect
          previews={previews}
          selected={slateKeys}
          maxSlates={ARENA.maxSlates}
          onToggle={toggleSlate}
          onConfirm={confirmRound}
          onBack={() => setStep("categories")}
        />
      )}

      {step === "playing" && <ArenaPlay round={round} onDone={onPlayDone} />}

      {step === "revealing" && (
        <ArenaReveal
          played={played}
          onReplay={replay}
          onExit={() => router.push("/app/practice")}
          replayPending={false}
        />
      )}
    </div>
  );
}
