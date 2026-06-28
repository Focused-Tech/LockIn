"use client";

import { useEffect, useState } from "react";
import { isSoundOn, setSoundOn } from "@/lib/practice/sound";

/** Practice sound on/off toggle (persisted; default on; respects silent mode). */
export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(isSoundOn()), []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        setSoundOn(next);
      }}
      className="rounded-full border border-border bg-surface-card px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
    >
      {on ? "🔊 Sound on" : "🔇 Sound off"}
    </button>
  );
}
