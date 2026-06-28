"use client";

import { useEffect } from "react";
import {
  isMusicOn,
  startMusic,
  stopMusic,
  type MusicTrack,
} from "@/lib/practice/music";

/**
 * Drives the looping practice music for the screen it's mounted on. Starts the
 * track (when music is on), retries on the first user gesture (autoplay policy),
 * stops on app background (visibilitychange) and on unmount (leaving practice).
 */
export function PracticeMusic({ track }: { track: MusicTrack }) {
  useEffect(() => {
    const tryStart = () => {
      if (isMusicOn()) startMusic(track);
    };
    tryStart();

    const onFirstGesture = () => {
      tryStart();
      window.removeEventListener("pointerdown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture);

    const onVisibility = () => {
      if (document.hidden) stopMusic();
      else tryStart();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("visibilitychange", onVisibility);
      stopMusic(); // leaving practice stops the music
    };
  }, [track]);

  return null;
}
