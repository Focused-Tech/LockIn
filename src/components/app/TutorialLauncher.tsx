"use client";

import { useState } from "react";
import {
  TUTORIALS,
  TUTORIAL_PLACEHOLDER,
  type TutorialMode,
} from "@/lib/tutorial/tutorials";
import { markTutorialSeen } from "@/app/app/tutorial/actions";

/**
 * TUTORIAL LAUNCHER (§4, shell). Fires ONCE, immediately after onboarding, for the mode the user
 * selected — the first screen is the Locksmith at her desk offering SKIP or continue. Skip is
 * honoured permanently for that mode (both skip and finish call markTutorialSeen). A version bump
 * re-offers it (the server record carries the version). Copy is DATA — the steps come from TUTORIALS
 * and are empty for now, so an honest placeholder renders in the empty slot (never invented rules).
 */
export function TutorialLauncher({
  mode,
  initialSeen,
}: {
  mode: TutorialMode;
  initialSeen: boolean;
}) {
  const slot = TUTORIALS[mode];
  const [dismissed, setDismissed] = useState(initialSeen);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  async function finish() {
    setBusy(true);
    await markTutorialSeen(mode);
    setDismissed(true);
  }

  const hasCopy = slot.steps.length > 0;
  const atEnd = !hasCopy || step >= slot.steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[22px] border border-border bg-surface-card sm:rounded-[22px]">
        {/* Her at her desk — the first thing you see (reuses the approved desk image). */}
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/foxpit/locksmith/locksmith_desk.png"
            alt="The Locksmith at her desk"
            className="h-40 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-3 pt-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
              {slot.modeLabel} · How to play
            </p>
            <p className="text-lg font-semibold text-white">The Locksmith</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {hasCopy ? (
            <p className="text-sm leading-relaxed text-foreground">{slot.steps[step]}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted">{TUTORIAL_PLACEHOLDER}</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="rounded border border-border px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (atEnd) void finish();
              else setStep((s) => s + 1);
            }}
            className="flex-1 rounded border border-accent-border bg-accent-soft px-4 py-3 text-sm font-semibold text-accent transition-colors disabled:opacity-60"
          >
            {atEnd ? "Got it — start playing" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
