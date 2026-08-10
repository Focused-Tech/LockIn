"use client";

import { useCrossParlay } from "./CrossParlayProvider";

/**
 * Per-prediction control to add the currently-selected side to the cross-slate
 * parlay cart. Renders nothing until a side is picked (or outside the provider).
 */
export function AddToParlay({
  slateId,
  slateTitle,
  lockTimeMs,
  predictionId,
  question,
  optionLabel,
  choice,
}: {
  slateId: string;
  slateTitle: string;
  lockTimeMs: number;
  predictionId: string;
  question: string;
  optionLabel: string;
  choice: "a" | "b" | undefined;
}) {
  const cart = useCrossParlay();
  if (!cart || !choice) return null;

  const inCart = cart.has(slateId, predictionId);

  return (
    <div className="mt-2 flex items-center justify-between">
      <span className="text-xs text-muted">Add to a cross-slate parlay</span>
      {inCart ? (
        <button
          type="button"
          onClick={() => cart.remove(slateId, predictionId)}
          className="text-xs font-medium text-accent"
        >
          ✓ in parlay · remove
        </button>
      ) : (
        <button
          type="button"
          onClick={() =>
            cart.add({
              slateId,
              slateTitle,
              predictionId,
              question,
              pickValue: choice,
              pickLabel: optionLabel,
              lockTimeMs,
            })
          }
          className="rounded border border-ai/40 bg-[rgba(59,139,255,0.12)] px-2 py-1 text-xs font-medium text-ai"
        >
          + add to parlay
        </button>
      )}
    </div>
  );
}
