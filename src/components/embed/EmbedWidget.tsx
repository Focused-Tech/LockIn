import { Logo } from "@/components/Logo";
import { Pill } from "@/components/ui";
import { CardRushMeta } from "@/components/CardRushMeta";
import { formatCents, formatMultiple } from "@/lib/utils";
import type { EmbedView } from "@/lib/embed";
import { Countdown } from "./Countdown";

/**
 * Presentational embed card. Reused by the iframe widget (`/embed/[id]`) and the
 * public share page (`/s/[id]`). `ctaHref` + `ctaNewTab` adapt the call-to-action
 * to the context (open LockIn in a new tab from an iframe; same tab on /s).
 */
export function EmbedWidget({
  view,
  ctaHref,
  ctaNewTab = false,
}: {
  view: EmbedView;
  ctaHref: string;
  ctaNewTab?: boolean;
}) {
  const prediction = view.predictions[0];

  return (
    <div
      className={
        "mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border bg-surface-card p-4 " +
        (view.isCardRush ? "border-rush-border" : "border-border")
      }
    >
      <div className="flex items-center justify-between">
        <Logo />
        {view.state === "live" ? (
          <Pill tone="live">Live</Pill>
        ) : view.state === "settled" ? (
          <Pill tone="win">Settled</Pill>
        ) : (
          <Pill tone="neutral">Locked</Pill>
        )}
      </div>

      {view.isCardRush && (
        <CardRushMeta
          rushMultiplier={view.rushMultiplier}
          entryCount={view.entryCount}
          maxEntries={view.maxEntries}
        />
      )}

      <div className="flex items-center gap-2">
        <Pill tone="accent">{view.category}</Pill>
        <span className="text-xs text-muted">{view.entryCount} entered</span>
      </div>

      <h2 className="text-base font-semibold leading-snug">{view.title}</h2>

      {/* Pool / prize */}
      <div className="flex items-center justify-between rounded border border-border p-3">
        <div>
          <p className="text-xs text-muted">Prize pool</p>
          <p className="text-lg font-semibold text-win">
            {formatCents(view.prizePoolCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">1st place</p>
          <p className="text-lg font-semibold">
            {formatCents(view.firstPlaceCents)}
            {view.state === "live" && (
              <span className="ml-1 text-sm text-muted">
                {formatMultiple(view.firstPlaceMultiple)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* State-specific body */}
      {view.state === "live" && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Picks close in</span>
            <Countdown targetMs={view.lockTimeMs} />
          </div>
          {prediction && (
            <div>
              <p className="mb-1 text-sm font-medium">{prediction.question}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Option label={prediction.optionA} prob={prediction.probA} />
                <Option label={prediction.optionB} prob={prediction.probB} />
              </div>
            </div>
          )}
        </>
      )}

      {view.state === "locked" && (
        <p className="text-sm text-muted">
          Entries are closed — results pending.
        </p>
      )}

      {view.state === "settled" && (
        <div className="flex flex-col gap-2">
          {view.accuracyPct !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">AI odds hit rate</span>
              <span className="font-medium">{view.accuracyPct}%</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {view.predictions.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border border-border bg-surface px-3 py-1.5 text-sm"
              >
                <span className="truncate text-muted">{p.question}</span>
                <span className="ml-2 shrink-0 font-medium text-win">
                  {p.result === "a"
                    ? p.optionA
                    : p.result === "b"
                      ? p.optionB
                      : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <a
        href={ctaHref}
        target={ctaNewTab ? "_blank" : undefined}
        rel={ctaNewTab ? "noopener noreferrer" : undefined}
        className="rounded border border-accent-border bg-accent-soft px-4 py-2.5 text-center text-sm font-medium text-accent"
      >
        {view.state === "settled" ? "Join on LockIn" : "Play now on LockIn"}
      </a>

      <p className="text-center text-[10px] text-muted">
        Skill-based prediction contest. Not gambling. 18+.
      </p>
    </div>
  );
}

function Option({ label, prob }: { label: string; prob: number }) {
  return (
    <div className="rounded border border-border bg-surface px-3 py-2">
      <p className="truncate font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted">{prob}%</p>
    </div>
  );
}
