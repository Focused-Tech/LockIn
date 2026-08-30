"use client";

import { useEffect, useState } from "react";
import type { FeedSlate } from "@/lib/feed";
import {
  buildDemoPredictions,
  DEMO_START_LEGS,
  DEMO_MAX_LEGS,
} from "@/lib/demoSlates";
import { SlatePicker } from "./SlatePicker";

const playsKey = (id: string) => `lockin.demo.plays.${id}`;
const seenKey = (id: string) => `lockin.demo.seen.${id}`;

/**
 * DEMO ROTATION — owns the demo's progression. Each replay serves a fresh question set with one
 * more leg than the last (2 → 3 → 4 → 5, then holds at 5, still rotating), and never repeats a
 * question until the pool is spent. Progress persists in localStorage so it grows across visits.
 * The pick → lock-in flow itself is SlatePicker (isDemo) — this only feeds it and advances.
 */
export function DemoSlatePlayer({
  base,
  cashBalanceCents,
  registeredState,
}: {
  base: FeedSlate;
  cashBalanceCents: number;
  registeredState: string | null;
}) {
  const id = base.id;
  const [plays, setPlays] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Hydrate progress from localStorage after mount (SSR renders the starter set, then this catches up).
  useEffect(() => {
    try {
      const p = Number(window.localStorage.getItem(playsKey(id)) ?? "0");
      const s = JSON.parse(window.localStorage.getItem(seenKey(id)) ?? "[]");
      if (Number.isFinite(p) && p > 0) setPlays(p);
      if (Array.isArray(s)) setSeen(s);
    } catch {
      /* first run / storage blocked — start fresh */
    }
    setLoaded(true);
  }, [id]);

  const legs = Math.min(DEMO_START_LEGS + plays, DEMO_MAX_LEGS);
  const { predictions, cycled } = buildDemoPredictions(id, legs, seen);
  const slate: FeedSlate = { ...base, predictions };
  const nextLegs = Math.min(legs + 1, DEMO_MAX_LEGS);

  function onReplay() {
    const currentIds = predictions.map((p) => p.id);
    // When the pool just cycled, restart `seen` from this set; otherwise accumulate.
    const nextSeen = cycled ? currentIds : [...seen, ...currentIds];
    const nextPlays = plays + 1;
    setSeen(nextSeen);
    setPlays(nextPlays);
    try {
      window.localStorage.setItem(playsKey(id), String(nextPlays));
      window.localStorage.setItem(seenKey(id), JSON.stringify(nextSeen));
    } catch {
      /* storage blocked — progress just won't persist */
    }
  }

  return (
    <SlatePicker
      // Remount on each replay so the pick flow resets cleanly to the new (larger) set.
      key={`${id}-${plays}-${loaded ? 1 : 0}`}
      slate={slate}
      cashBalanceCents={cashBalanceCents}
      kycVerified
      kycStatus="verified"
      registeredState={registeredState}
      existingEntry={null}
      shadowEarnings={null}
      isDemo
      demoReplay={{ nextLegs, atMax: legs >= DEMO_MAX_LEGS, onReplay }}
    />
  );
}
