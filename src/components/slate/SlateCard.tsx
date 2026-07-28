"use client";

/**
 * SLICE 3 — THE UNIFORM SLATE CARD.
 *
 * ONE component renders a slate/leg for EVERY mode (practice, Fox Pit, Lone Wolf, beginner,
 * advanced, creator preview). There is never a second card layout. Currency and context swap per
 * mode via props — there is no cash card and no coin card, one card.
 *
 * Structure (from the approved mockup): leg container (neutral/ok/bad border state) → question line
 * → pick chips (label + secondary line, selectable) → REQUIRED display-only context strip → flag
 * row (ok/bad, fix-naming copy) → per-CARD stake footer (chips at the bottom, unlocked only after
 * this card's questions are answered — STAKE IS PER CARD, NEVER PER QUESTION).
 *
 * Colors reference TOKENS by name only (slice 8 assigns the purple/gold/orange meaning). No raw hex.
 */
import { cn } from "@/lib/utils";

export type CardCurrency = "cash" | "coins";
export type LegState = "neutral" | "ok" | "bad";

export interface SlatePick {
  label: string;
  /** secondary team / context line under the label. */
  secondary?: string;
  selected?: boolean;
  /** settled outcome, when read-only. */
  result?: "correct" | "wrong" | null;
}

/** SLICE 3.2 / 2.5 — context is REQUIRED on every leg and is DISPLAY ONLY, never the threshold. */
export interface LegDisplayContext {
  seasonAverage: string;
  last3Form: string;
  matchupNote: string;
}

export interface SlateLeg {
  question: string;
  picks: SlatePick[];
  state: LegState;
  context: LegDisplayContext;
  /** ok/bad flag with fix-naming copy (Lockpick fills this — slice 4). */
  flag?: { variant: "ok" | "bad"; message: string } | null;
}

export interface SlateCardProps {
  /** the mode this card renders in — "foxpit" | "beginner" | "advanced" | "practice" | "creator" | … */
  mode: string;
  /** currency is a PROP — same card, dollars or coins. */
  currency: CardCurrency;
  legs: SlateLeg[];
  /** per-card stake chip options (the stake footer). */
  stakeOptions: number[];
  selectedStake?: number | null;
  /** this card's questions are answered → the stake footer unlocks (slice 4.6). */
  answered?: boolean;
  locked?: boolean;
  readOnly?: boolean;
  title?: string;
  category?: string;
  onPick?: (legIndex: number, pickIndex: number) => void;
  onStake?: (stake: number) => void;
}

const LEG_BORDER: Record<LegState, string> = {
  neutral: "border-border",
  ok: "border-win/60",
  bad: "border-loss",
};

function currencyLabel(currency: CardCurrency, amount: number): string {
  return currency === "cash" ? `$${amount}` : `${amount} ⛃`;
}

export function SlateCard({
  mode,
  currency,
  legs,
  stakeOptions,
  selectedStake = null,
  answered = false,
  locked = false,
  readOnly = false,
  title,
  category,
  onPick,
  onStake,
}: SlateCardProps) {
  return (
    <div
      data-mode={mode}
      data-currency={currency}
      className="rounded-xl border border-border bg-surface-card p-3"
    >
      {(category || title) && (
        <div className="mb-2">
          {category && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-accent">{category}</div>
          )}
          {title && <div className="font-serif text-base leading-tight text-foreground">{title}</div>}
        </div>
      )}

      {legs.map((leg, li) => (
        <div key={li} data-leg-state={leg.state} className={cn("mb-2 rounded-lg border bg-surface p-2.5", LEG_BORDER[leg.state])}>
          <div className="mb-1.5 text-sm text-foreground">{leg.question}</div>

          <div className="flex flex-wrap gap-1.5">
            {leg.picks.map((pick, pi) => (
              <button
                key={pi}
                type="button"
                data-pick
                data-selected={pick.selected ? "true" : "false"}
                disabled={readOnly || locked}
                onClick={() => onPick?.(li, pi)}
                className={cn(
                  "rounded-md border px-2 py-1 text-left text-xs",
                  pick.selected ? "border-accent text-accent" : "border-border text-foreground",
                  pick.result === "correct" && "border-win text-win",
                  pick.result === "wrong" && "border-loss text-loss",
                )}
              >
                <span className="block">{pick.label}</span>
                {pick.secondary && <span className="block text-[10px] text-muted">{pick.secondary}</span>}
              </button>
            ))}
          </div>

          {/* SLICE 2.5 — required display-only context strip. Never a threshold. */}
          <div data-context className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
            <span>Season avg: {leg.context.seasonAverage}</span>
            <span>Last 3: {leg.context.last3Form}</span>
            <span>{leg.context.matchupNote}</span>
          </div>

          {leg.flag && (
            <div
              data-flag={leg.flag.variant}
              className={cn(
                "mt-2 rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug",
                leg.flag.variant === "ok" ? "border-win text-win" : "border-loss text-loss",
              )}
              dangerouslySetInnerHTML={{ __html: leg.flag.message }}
            />
          )}
        </div>
      ))}

      {/* SLICE 3.2 / 4.6 — per-CARD stake footer, unlocked only after this card's questions are answered. */}
      {stakeOptions.length > 0 && (
        <div data-stake-footer className="mt-1 border-t border-border pt-2">
          {!answered && !readOnly && (
            <div className="mb-1 text-[10px] text-muted">Answer the questions on this card to stake.</div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {stakeOptions.map((s) => (
              <button
                key={s}
                type="button"
                data-stake={s}
                disabled={!answered || readOnly || locked}
                onClick={() => onStake?.(s)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-bold",
                  selectedStake === s ? "border-accent text-accent" : "border-border text-foreground",
                  (!answered || readOnly || locked) && "opacity-40",
                )}
              >
                {currencyLabel(currency, s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
