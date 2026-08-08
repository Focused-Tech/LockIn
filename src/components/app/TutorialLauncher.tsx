"use client";

import { useState } from "react";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";
import { markTutorialSeen } from "@/app/app/tutorial/actions";
import { LocksmithChat } from "./LocksmithChat";

/**
 * TUTORIAL — the full-screen Locksmith SCREEN. It is now a THIN WRAPPER around the canonical
 * {@link LocksmithChat} (architect ruling L: one component everywhere): this file owns only the
 * full-screen container, the START PLAYING CTA, and the once-per-mode seen-record. The chat, hero,
 * ChipDock, autosize input, and mic/send pair all come from LocksmithChat.
 *
 * Fires once per mode; in onboarding it advances into the app on finish (onDone), else it dismisses.
 */
export function TutorialLauncher({
  mode,
  initialSeen,
  onDone,
}: {
  mode: TutorialMode;
  initialSeen: boolean;
  onDone?: () => void;
}) {
  const slot = TUTORIALS[mode];
  const [dismissed, setDismissed] = useState(initialSeen);
  const [finishing, setFinishing] = useState(false);

  // START PLAYING / SKIP both end the tutorial. Never trap: persist in the background; in onboarding
  // advance after the write (2s cap) so the app layout won't re-offer.
  function finish() {
    if (finishing) return;
    setFinishing(true);
    const persist = markTutorialSeen(mode).catch(() => {});
    if (onDone) void Promise.race([persist, new Promise((r) => setTimeout(r, 2000))]).then(() => onDone());
    else setDismissed(true);
  }

  if (dismissed) return null;

  // The SOLE start CTA (the floating door was removed): "Start / Playing", the header-right slot.
  const startPlaying = (
    <button
      type="button"
      onClick={finish}
      className="text-center text-[13px] font-bold uppercase leading-[1.05] tracking-[0.06em] text-[color:var(--brand-orange)] underline-offset-2 hover:underline"
    >
      Start
      <br />
      Playing
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60]">
      <LocksmithChat
        mode={mode}
        seed={slot.intro}
        steps={slot.steps.length ? slot.steps : undefined}
        autoWalkthrough
        headerCta={startPlaying}
        onDismiss={finish}
        dismissLabel="Skip"
      />
    </div>
  );
}
