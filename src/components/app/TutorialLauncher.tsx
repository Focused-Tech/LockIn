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
  const [step, setStep] = useState(0);

  if (dismissed) return null;

  // Dismiss IMMEDIATELY on tap — never trap the user behind a pending/failed server write. The
  // seen-record is written best-effort in the background; if it fails the tutorial simply re-offers
  // next time, which is harmless. (Fixes: Skip/Continue could hang if markTutorialSeen rejected.)
  function finish() {
    setDismissed(true);
    void markTutorialSeen(mode).catch(() => {});
  }

  const hasCopy = slot.steps.length > 0;
  const atEnd = !hasCopy || step >= slot.steps.length - 1;

  return (
    // FULL-SCREEN takeover (§4 "the Locksmith SCREEN"). Fills the viewport, honours the top + bottom
    // safe-area insets, and shows her at her desk with her head fully in frame.
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-surface-card"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Her at her desk — the de-greened image composites on the surface; object-contain so the whole
          figure (head + ears + desk) is always visible, never cropped. */}
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/locksmith/locksmith_desk_clean.png"
          alt="The Locksmith at her desk"
          className="h-full w-full object-contain object-bottom"
        />
        <div className="absolute inset-x-0 top-0 px-6 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {slot.modeLabel} · How to play
          </p>
          <p className="text-2xl font-semibold text-white">The Locksmith</p>
        </div>
      </div>

      {/* Copy panel */}
      <div className="shrink-0 border-t border-border px-6 pb-2 pt-4">
        {hasCopy ? (
          <p className="text-[15px] leading-relaxed text-foreground">{slot.steps[step]}</p>
        ) : (
          <p className="text-[15px] leading-relaxed text-muted">{TUTORIAL_PLACEHOLDER}</p>
        )}
      </div>

      {/* Safe-area: the action row clears the Android gesture/nav bar so Skip/Continue are always
          tappable (they were being covered by the system bar → the user couldn't move forward). */}
      <div
        className="flex shrink-0 items-center gap-2 px-6 pt-4"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          type="button"
          onClick={finish}
          className="rounded border border-border px-5 py-3.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => {
            if (atEnd) finish();
            else setStep((s) => s + 1);
          }}
          className="flex-1 rounded border border-accent-border bg-accent-soft px-4 py-3.5 text-sm font-semibold text-accent transition-colors"
        >
          {atEnd ? "Got it — start playing" : "Next"}
        </button>
      </div>
    </div>
  );
}
