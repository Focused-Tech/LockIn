"use client";

import { useEffect, useState } from "react";
import { isSfxOn, setSfxOn } from "@/lib/practice/sound";
import { isMusicOn, setMusicOn, startMusic, type MusicTrack } from "@/lib/practice/music";

/** SFX + background-music toggles (independent; both respect device silent mode). */
export function AudioSettings({ musicTrack }: { musicTrack?: MusicTrack }) {
  const [sfx, setSfx] = useState(true);
  const [music, setMusic] = useState(false);

  useEffect(() => {
    setSfx(isSfxOn());
    setMusic(isMusicOn());
  }, []);

  const chip =
    "rounded-full border px-3 py-1 text-xs font-medium transition-colors ";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={sfx}
        onClick={() => {
          const next = !sfx;
          setSfx(next);
          setSfxOn(next);
        }}
        className={
          chip +
          (sfx
            ? "border-accent-border bg-accent-soft text-accent"
            : "border-border bg-surface-card text-muted")
        }
      >
        {sfx ? "🔊 SFX" : "🔇 SFX"}
      </button>
      <button
        type="button"
        aria-pressed={music}
        onClick={() => {
          const next = !music;
          setMusic(next);
          setMusicOn(next); // also stops music when turned off
          if (next && musicTrack) startMusic(musicTrack); // user gesture unblocks autoplay
        }}
        className={
          chip +
          (music
            ? "border-accent-border bg-accent-soft text-accent"
            : "border-border bg-surface-card text-muted")
        }
      >
        {music ? "🎵 Music" : "🎵 Music off"}
      </button>
    </div>
  );
}
