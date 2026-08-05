"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, type EntryTierConfig, type SlateStatus } from "@/lib/firebase/types";
import { FEED_STATUSES, type FeedSlate } from "@/lib/feed";
import { ENTRY_TIERS, type EntryTier } from "@/lib/constants";
// THE FLOOR contest card (explore.html) — feed-only, so the uniform tower slate/SlateCard is untouched.
import { FloorCard } from "@/components/feed/FloorCard";
import { DEMO_SLATES } from "@/lib/demoSlates";
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
  // §4.2 — currency + stake live behind ONE filter control (a popover), not two stacked rows.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Realtime: keep prize pools / counts live as entries land. Predictions + creator info are taken
  // from the initial server payload (they rarely change after publish).
  useEffect(() => {
    const byId = new Map(initialSlates.map((s) => [s.id, s]));

    const unsub = onSnapshot(
      collection(getDb(), COLLECTIONS.slates),
      (snap) => {
        const next: FeedSlate[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as SlateSnapshot;
          if (!FEED_STATUSES.includes(data.status)) return;
          const seed = byId.get(doc.id);
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
            predictions: seed?.predictions ?? [],
            withheld: seed?.withheld,
            creatorName: seed?.creatorName ?? null,
            creatorTrackRecord: seed?.creatorTrackRecord ?? null,
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

  const tabs = useMemo(() => [FOR_YOU, "All", ...[...counts.keys()].sort()], [counts]);

  // "For you": deterministic recommendation order. Other tabs: plain chronological (filtered).
  const ordered = useMemo<FeedSlate[]>(() => {
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
      return recs.map((r) => byId.get(r.slate.id)).filter((s): s is FeedSlate => s !== undefined);
    }
    const filtered = category === "All" ? slates : slates.filter((s) => s.category === category);
    return filtered;
  }, [category, slates, signals]);

  const free = mode === "free";

  return (
    // §5.2 — clearance so the last card clears the bottom nav AND the two floating FABs (Locksmith /
    // parlay) that sit at bottom-[4.5rem]. §5.3 — gesture scroll, no visible scrollbar (global rule).
    <div className="flex flex-col gap-4 pb-36">
      {/* §4.1/4.2 — ONE visible filter row: the category chips (horizontal scroll, single row) + a
          single Filters control. Currency + stake moved behind it. */}
      <div className="flex items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab === category;
            const count = tab === "All" || tab === FOR_YOU ? slates.length : counts.get(tab) ?? 0;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setCategory(tab)}
                aria-pressed={active}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-medium transition-colors " +
                  (active
                    ? "border-accent-border bg-accent-soft text-accent"
                    : "border-[#2A3D52] bg-surface-card text-foreground hover:border-accent-border hover:text-accent")
                }
              >
                {tab}
                <span className={"rounded-full px-1.5 text-xs " + (active ? "bg-accent/15 text-accent" : "bg-surface text-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
        {/* single filter control — shows the current currency/stake selection; opens the popover. */}
        <button
          type="button"
          data-filter-control
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className={
            "flex shrink-0 items-center gap-1 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-medium transition-colors " +
            (filtersOpen ? "border-accent-border bg-accent-soft text-accent" : "border-[#2A3D52] bg-surface-card text-muted hover:text-foreground")
          }
        >
          {free ? "Free" : `Paid · $${tier}`}
          <span aria-hidden className="text-xs">▾</span>
        </button>
      </div>

      {/* the single filter popover — currency + stake, both collapsed behind the control above. */}
      {filtersOpen && (
        <div data-filter-panel className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-card p-3">
          <div className="flex rounded-full border border-border p-0.5">
            {(["paid", "free"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={"rounded-full px-3 py-1 text-sm capitalize transition-colors " + (mode === m ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")}
              >
                {m}
              </button>
            ))}
          </div>
          {!free && (
            <div className="flex gap-1.5">
              {ENTRY_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={"rounded border px-2.5 py-1 text-sm transition-colors " + (tier === t ? "border-accent-border bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground")}
                >
                  ${t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* §4.3 — "Popular right now" is a section LABEL above the group (For You tab), not a per-card badge. */}
      {category === FOR_YOU && ordered.length > 0 && (
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Popular right now</h2>
      )}

      {/* §5.1 — a single full-width vertical column. Demo slates are PINNED at the top (free to
          play through) so any tester can reach the pick → lock-in flow without a funded wallet;
          the real feed follows. */}
      <div className="flex flex-col gap-3">
        {DEMO_SLATES.map((slate) => (
          <Link key={slate.id} href={`/app/slate/${slate.id}`} className="block">
            <FloorCard slate={slate} tier={tier} currency="cash" />
          </Link>
        ))}
        {ordered.length === 0 ? (
          <div className="rounded border border-border bg-surface-card p-8 text-center text-sm text-muted">
            No live contests right now — try a demo above while you wait.
          </div>
        ) : (
          ordered.map((slate) => (
            <Link key={slate.id} href={`/app/slate/${slate.id}`} className="block">
              {slate.withheld ? (
                <div data-withheld="true" className="rounded-[15px] border border-border bg-surface-card p-4">
                  <p className="text-xs font-semibold text-muted">{slate.category} · Under review</p>
                  <h3 className="mt-1 text-base font-semibold">{slate.title}</h3>
                  <p className="mt-1 text-sm text-muted">This contest is under review and isn&apos;t available to play.</p>
                </div>
              ) : (
                <FloorCard slate={slate} tier={tier} currency={free ? "coins" : "cash"} />
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
