"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, type EntryTierConfig, type SlateStatus } from "@/lib/firebase/types";
import { FEED_STATUSES, type FeedSlate } from "@/lib/feed";
import { ENTRY_TIERS, type EntryTier } from "@/lib/constants";
import { SlateCard } from "@/components/feed/SlateCard";
import { RushBanner } from "@/components/feed/RushBanner";
import { recommendSlates, type RecSignals } from "@/lib/recommendations";

const FOR_YOU = "For you";

/** Minimal shape we read off each live slate document (web SDK). */
interface SlateSnapshot {
  title: string;
  category: string;
  status: SlateStatus;
  creatorId: string | null;
  entryTiers: EntryTierConfig[];
  entryCount?: number;
  isCardRush?: boolean;
  rushMultiplier?: number;
  maxEntries?: number | null;
  lockTime?: { toMillis(): number };
}

export function ExploreFeed({
  initialSlates,
  signals,
}: {
  initialSlates: FeedSlate[];
  signals: RecSignals;
}) {
  const [slates, setSlates] = useState<FeedSlate[]>(initialSlates);
  const [category, setCategory] = useState<string>(FOR_YOU);
  const [mode, setMode] = useState<"paid" | "free">("paid");
  const [tier, setTier] = useState<EntryTier>(5);

  // Realtime: keep prize pools / counts live as entries land. Predictions are
  // taken from the initial server payload (they rarely change after publish).
  useEffect(() => {
    const predsById = new Map(initialSlates.map((s) => [s.id, s.predictions]));

    const unsub = onSnapshot(
      collection(getDb(), COLLECTIONS.slates),
      (snap) => {
        const next: FeedSlate[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as SlateSnapshot;
          if (!FEED_STATUSES.includes(data.status)) return;
          next.push({
            id: doc.id,
            title: data.title,
            category: data.category,
            status: data.status,
            creatorId: data.creatorId ?? null,
            entryTiers: data.entryTiers ?? [],
            entryCount: data.entryCount ?? 0,
            isCardRush: data.isCardRush ?? false,
            rushMultiplier: data.rushMultiplier ?? 1,
            maxEntries: data.maxEntries ?? null,
            lockTimeMs: data.lockTime?.toMillis() ?? 0,
            predictions: predsById.get(doc.id) ?? [],
          });
        });
        next.sort((a, b) => a.lockTimeMs - b.lockTimeMs);
        setSlates(next);
      },
      () => {
        // Listener failed (offline / rules) — keep the SSR snapshot in place.
      },
    );

    return unsub;
  }, [initialSlates]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of slates) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    return map;
  }, [slates]);

  const tabs = useMemo(
    () => [FOR_YOU, "All", ...[...counts.keys()].sort()],
    [counts],
  );

  // "For you": deterministic recommendation order + per-card reasons. Other tabs:
  // plain chronological (filtered), no reason.
  const ordered = useMemo<{ slate: FeedSlate; reason: string | null }[]>(() => {
    if (category === FOR_YOU) {
      const recs = recommendSlates(
        slates.map((s) => ({
          id: s.id,
          category: s.category,
          creatorId: s.creatorId,
          tiers: s.entryTiers.map((t) => t.tier),
          entryCount: s.entryCount,
          lockTimeMs: s.lockTimeMs,
        })),
        signals,
        Date.now(),
      );
      const byId = new Map(slates.map((s) => [s.id, s]));
      return recs
        .map((r) => ({ slate: byId.get(r.slate.id), reason: r.reason }))
        .filter(
          (x): x is { slate: FeedSlate; reason: string | null } =>
            x.slate !== undefined,
        );
    }
    const filtered =
      category === "All" ? slates : slates.filter((s) => s.category === category);
    return filtered.map((s) => ({ slate: s, reason: null }));
  }, [category, slates, signals]);

  // Live, joinable Card Rushes drive the pulsing banner. Site-wide (ignores the
  // category/tier filters) since a rush is a platform-wide moment; sorted by
  // lock time so the banner features the most urgent one.
  const liveRushes = useMemo(
    () =>
      slates.filter(
        (s) =>
          s.isCardRush &&
          s.status === "live" &&
          (s.maxEntries == null || s.entryCount < s.maxEntries),
      ),
    [slates],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Pulsing Card Rush banner (only when a rush is active) */}
      <RushBanner rushes={liveRushes} />

      {/* Category pills — wrapping rows of clearly-bordered chips */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab === category;
          const count =
            tab === "All" || tab === FOR_YOU
              ? slates.length
              : counts.get(tab) ?? 0;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setCategory(tab)}
              aria-pressed={active}
              className={
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border bg-surface-card text-foreground hover:border-accent-border hover:text-accent")
              }
            >
              {tab}
              <span
                className={
                  "rounded-full px-1.5 text-xs " +
                  (active ? "bg-accent/15 text-accent" : "bg-surface text-muted")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Free / Paid + tier selector */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-full border border-border p-0.5">
          {(["paid", "free"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-full px-3 py-1 text-sm capitalize transition-colors " +
                (mode === m
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground")
              }
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "paid" && (
          <div className="flex gap-1.5">
            {ENTRY_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={
                  "rounded border px-2.5 py-1 text-sm transition-colors " +
                  (tier === t
                    ? "border-accent-border bg-accent-soft text-accent"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                ${t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      {ordered.length === 0 ? (
        <div className="rounded border border-border bg-surface-card p-8 text-center text-sm text-muted">
          No live contests right now. Check back soon.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map(({ slate, reason }) => (
            <Link key={slate.id} href={`/app/slate/${slate.id}`} className="block">
              <SlateCard
                slate={slate}
                tier={tier}
                free={mode === "free"}
                reason={reason}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
