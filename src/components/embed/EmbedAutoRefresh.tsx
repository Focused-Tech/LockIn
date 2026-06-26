"use client";

import { useEffect } from "react";

/**
 * Periodically reloads the embed so it auto-transitions between live → locked →
 * settled states without the creator touching anything. Only reloads while the
 * iframe is visible.
 */
export function EmbedAutoRefresh({ seconds = 60 }: { seconds?: number }) {
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") location.reload();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return null;
}
