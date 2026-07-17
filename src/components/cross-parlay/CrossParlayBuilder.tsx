"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  CROSS_PARLAY_MAX_PICKS,
  CROSS_PARLAY_MIN_PICKS,
  CROSS_PARLAY_MIN_SLATES,
  ENTRY_TIERS,
  FREE_ENTRY_COIN_COST,
  type EntryTier,
} from "@/lib/constants";
import { parlayMultiplier } from "@/lib/contest/crossParlay";
import { formatCents } from "@/lib/utils";
import { useCrossParlay } from "./CrossParlayProvider";
import { submitCrossParlay } from "./actions";

/** Floating parlay icon (pick-count badge) + the build/submit panel. */
export function CrossParlayBuilder() {
  const cart = useCrossParlay();
  const [tier, setTier] = useState<EntryTier>(5);
  const [free, setFree] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const pathname = usePathname();

  // Keep the mode picker clean — hide the parlay launcher on the arena chooser.
  if (!cart || pathname === "/app/practice/arena/chooser") return null;
  const { picks, slateCount, open, setOpen, remove, clear } = cart;

  const enoughPicks = picks.length >= CROSS_PARLAY_MIN_PICKS;
  const enoughSlates = slateCount >= CROSS_PARLAY_MIN_SLATES;
  const valid = enoughPicks && enoughSlates && picks.length <= CROSS_PARLAY_MAX_PICKS;
  const multiple = parlayMultiplier(picks.length);

  async function submit() {
    setError(null);
    setPending(true);
    const res = await submitCrossParlay({
      picks: picks.map((p) => ({
        slateId: p.slateId,
        predictionId: p.predictionId,
        pickValue: p.pickValue,
      })),
      tier,
      free,
    });
    setPending(false);
    if (res.ok) {
      clear();
      setDone(true);
      setError(null);
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      {/* Persistent floating icon with pick-count badge */}
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
        aria-label="Open your parlay"
        className="fixed bottom-[4.5rem] left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-ai shadow-lg backdrop-blur transition-colors hover:bg-[rgba(59,139,255,0.25)]"
      >
        <span className="text-lg">⚡</span>
        {picks.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-background">
            {picks.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl border border-border bg-surface-card p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Cross-slate parlay</h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/app/parlays"
                  onClick={() => setOpen(false)}
                  className="text-sm text-ai hover:opacity-80"
                >
                  Your parlays
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>

            {done ? (
              <div className="flex flex-col gap-3 py-6 text-center">
                <p className="text-sm font-semibold text-win">Parlay submitted!</p>
                <p className="text-sm text-muted">
                  It settles once every included contest is final.
                </p>
                <Button variant="neutral" size="lg" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            ) : picks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No picks yet. Open a contest and tap &ldquo;Add to parlay&rdquo; on
                each question to combine calls across events.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  {picks.length} pick{picks.length === 1 ? "" : "s"} ·{" "}
                  {slateCount} contest{slateCount === 1 ? "" : "s"}
                  {multiple > 0 && (
                    <span className="ml-1 text-ai">· {multiple}× potential</span>
                  )}
                </p>

                <ul className="flex flex-col gap-2">
                  {picks.map((p) => (
                    <li
                      key={`${p.slateId}:${p.predictionId}`}
                      className="flex items-start justify-between gap-2 rounded border border-border bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted">{p.slateTitle}</p>
                        <p className="truncate text-sm">{p.question}</p>
                        <p className="text-xs font-medium text-accent">
                          {p.pickLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(p.slateId, p.predictionId)}
                        className="shrink-0 text-xs text-muted hover:text-loss"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Entry mode */}
                <div className="flex flex-col gap-2">
                  <div className="flex rounded-full border border-border p-0.5">
                    <button
                      type="button"
                      onClick={() => setFree(false)}
                      className={
                        "flex-1 rounded-full px-3 py-1 text-sm transition-colors " +
                        (!free ? "bg-accent-soft text-accent" : "text-muted")
                      }
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setFree(true)}
                      className={
                        "flex-1 rounded-full px-3 py-1 text-sm transition-colors " +
                        (free ? "bg-accent-soft text-accent" : "text-muted")
                      }
                    >
                      Free
                    </button>
                  </div>
                  {free ? (
                    <p className="text-sm text-muted">
                      {FREE_ENTRY_COIN_COST} coins
                    </p>
                  ) : (
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

                {!enoughSlates && (
                  <p className="text-xs text-muted">
                    Add picks from at least {CROSS_PARLAY_MIN_SLATES} different
                    contests.
                  </p>
                )}
                {error && <p className="text-sm text-loss">{error}</p>}

                <Button
                  variant="accent"
                  size="lg"
                  disabled={!valid || pending}
                  onClick={submit}
                >
                  {pending
                    ? "Submitting…"
                    : !valid
                      ? "Add 2+ picks from 2+ contests"
                      : free
                        ? `Submit · ${FREE_ENTRY_COIN_COST} coins`
                        : `Submit · ${formatCents(tier * 100)}`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
