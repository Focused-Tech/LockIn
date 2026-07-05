"use client";

import { Card, Pill } from "@/components/ui";
import { CardRushMeta } from "@/components/CardRushMeta";
import { computeSlateMetrics } from "@/lib/contest";
import { categoryTint } from "@/lib/practice/tints";
import type { EntryTier } from "@/lib/constants";
import type { FeedSlate } from "@/lib/feed";
import { formatCents, formatMultiple } from "@/lib/utils";

/** Resolve which tier config to display: the selected tier, else the lowest. */
function tierConfig(slate: FeedSlate, selected: EntryTier) {
  const exact = slate.entryTiers.find((t) => t.tier === selected);
  if (exact) return exact;
  return [...slate.entryTiers].sort((a, b) => a.tier - b.tier)[0];
}

export function SlateCard({
  slate,
  tier,
  free,
  reason,
}: {
  slate: FeedSlate;
  tier: EntryTier;
  free: boolean;
  /** Optional "For you" recommendation reason shown atop the card. */
  reason?: string | null;
}) {
  const config = tierConfig(slate, tier);
  const locked = slate.status === "locked";
  const prediction = slate.predictions[0];
  const tint = categoryTint(slate.category);

  const metrics = config
    ? computeSlateMetrics(
        config.tier,
        config.hostingFeeCents,
        slate.entryCount,
        slate.rushMultiplier,
      )
    : null;

  return (
    <Card
      data-tour="event-card"
      className="flex flex-col gap-3"
      style={{ borderColor: tint.border }}
    >
      {reason && (
        <p className="flex items-center gap-1 text-xs font-medium text-ai">
          <span aria-hidden>✨</span>
          {reason}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span
          className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
          style={{
            backgroundColor: tint.soft,
            borderColor: tint.border,
            color: tint.color,
          }}
        >
          {slate.category}
        </span>
        {locked ? (
          <Pill tone="neutral">Locked</Pill>
        ) : (
          <Pill tone="live">Live</Pill>
        )}
      </div>

      {slate.isCardRush && (
        <CardRushMeta
          rushMultiplier={slate.rushMultiplier}
          entryCount={slate.entryCount}
          maxEntries={slate.maxEntries}
          lockTimeMs={locked ? undefined : slate.lockTimeMs}
        />
      )}

      <h3 className="text-base font-semibold leading-snug">{slate.title}</h3>

      {locked || !metrics ? (
        <p className="text-sm text-muted">
          Locked — results pending.{" "}
          {metrics ? `Final pool ${formatCents(metrics.prizePoolCents)}.` : ""}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between rounded border border-border p-3">
            <div>
              <p className="text-xs text-muted">Prize pool</p>
              <p className="text-lg font-semibold text-win">
                {formatCents(metrics.prizePoolCents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">1st place</p>
              <p className="text-lg font-semibold">
                {formatCents(metrics.firstPlaceCents)}
                <span className="ml-1 text-sm text-muted">
                  {formatMultiple(metrics.firstPlaceMultiple)}
                </span>
              </p>
            </div>
          </div>

          {prediction && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{prediction.question}</p>
                <Pill tone="ai">AI odds</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <OptionPill label={prediction.optionA} prob={prediction.probA} />
                <OptionPill label={prediction.optionB} prob={prediction.probB} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Pool grows as more enter</span>
            <span className="font-medium text-foreground">
              {free
                ? "Free entry · coins"
                : `Enter ${formatCents(metrics.entryCostCents)}`}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function OptionPill({ label, prob }: { label: string; prob: number }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2">
      <span className="truncate text-sm font-medium text-foreground">
        {label}
      </span>
      <span className="ml-2 shrink-0 text-xs text-muted">{prob}%</span>
    </div>
  );
}
