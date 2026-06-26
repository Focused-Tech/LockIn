import { Pill } from "@/components/ui";
import { Countdown } from "@/components/Countdown";

/**
 * Card Rush badge + multiplier + (optional) max-entries progress bar + (optional)
 * lock countdown. Purple branding (the `rush` color is reserved for Card Rush).
 * Pass `lockTimeMs` only while the rush is still open (omit once locked).
 */
export function CardRushMeta({
  rushMultiplier,
  entryCount,
  maxEntries,
  lockTimeMs,
}: {
  rushMultiplier: number;
  entryCount: number;
  maxEntries: number | null;
  lockTimeMs?: number;
}) {
  const pct =
    maxEntries && maxEntries > 0
      ? Math.min(100, Math.round((entryCount / maxEntries) * 100))
      : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Pill tone="rush">⚡ Card Rush</Pill>
        <Pill tone="rush">{rushMultiplier}x prizes</Pill>
        {lockTimeMs ? (
          <span className="ml-auto text-xs text-rush">
            Locks in <Countdown targetMs={lockTimeMs} />
          </span>
        ) : null}
      </div>
      {maxEntries && (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-rush"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {entryCount}/{maxEntries} entries
            {entryCount >= maxEntries ? " · full" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
