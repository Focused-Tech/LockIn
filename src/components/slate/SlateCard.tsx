"use client";

/**
 * SLICE 3 — THE UNIFORM SLATE CARD (rebuilt to design/lockin_slate_card_mockup.html).
 *
 * ONE component for every mode. Currency + context swap per mode via props; there is never a second
 * card layout. Depth is part of the design — literal box-shadow values only (never var() or
 * color-mix() inside a shadow, which silently no-op). Keydrop is SCREEN CHROME, never on the card.
 *
 * FOX PIT CARVE-OUT (frozen, architect-confirmed): the Locksmith-dealt face-side cards keep their
 * existing baked header/wordmark — pass `faceImage="/foxpit/cards/card_front_single.png"` and the
 * card renders that image as its face with the category ring, instead of the code eyebrow/title.
 * The mockup's short hug-the-content `.mark` pill is DISREGARDED for Fox Pit (and used nowhere else).
 */
import { cn } from "@/lib/utils";
import { LockGlyph } from "@/components/practice/LockGlyph";

export type CardCurrency = "cash" | "coins";
export type LegState = "neutral" | "ok" | "bad";
/** always = stake always shown; afterAnswers = revealed once this card's questions are answered; none = no stake. */
export type StakeMode = "always" | "afterAnswers" | "none";

// Literal depth values from the reference (no var()/color-mix() in any shadow).
const SH = {
  card: "0 10px 30px rgba(0,0,0,.5)",
  rise: "inset 0 1px 0 rgba(255,255,255,.045), 0 2px 6px rgba(0,0,0,.45)",
  pick: "inset 0 1px 0 rgba(255,255,255,.06), 0 1px 3px rgba(0,0,0,.5)",
  pickSel: "inset 0 1px 0 rgba(255,255,255,.09), 0 0 0 3px rgba(255,255,255,.07), 0 3px 9px rgba(0,0,0,.55)",
  chipOn: "inset 0 1px 0 rgba(255,255,255,.28), 0 4px 12px rgba(0,0,0,.5)",
  cta: "inset 0 1px 0 rgba(255,255,255,.3), 0 6px 18px rgba(0,0,0,.55)",
  barInset: "inset 0 1px 2px rgba(0,0,0,.7)",
};
const PICK_GRADIENT = "linear-gradient(180deg,#1B212B 0%,#151A22 100%)";

export interface SlatePick {
  label: string;
  secondary?: string[];
  selected?: boolean;
  result?: "correct" | "wrong" | null;
}
export interface LegDisplayContext {
  seasonAverage: string;
  last3Form: string;
  matchupNote: string;
}
export interface SlateLeg {
  question: string;
  qs?: string;
  picks: SlatePick[];
  state: LegState;
  /** display-only context (sports slates). Optional — Fox Pit trivia has no such context; the
   *  PUBLISH-time requirement is enforced separately by validateLeg for creator sports slates. */
  context?: LegDisplayContext | null;
  flag?: { variant: "ok" | "bad"; message: string } | null;
  /** per-leg pick style (overrides the card-level pickStyle) — lets one card mix archetypes,
   *  e.g. "contest" for a head-to-head leg and "chips" for a milestone-count leg. */
  pickStyle?: "button" | "plain" | "contest" | "chips";
}
export interface SlateCardProps {
  mode: string;
  currency: CardCurrency;
  /** category-canon color — drives the bezel (border) + eyebrow/context highlights. */
  catColor: string;
  legs: SlateLeg[];
  eyebrow?: string;
  title?: string;
  sub?: string;
  stakeMode?: StakeMode;
  stakeOptions?: number[];
  selectedStake?: number | null;
  stakeLabel?: string;
  stakeNote?: string;
  /** afterAnswers: this card's questions are answered → the stake reveals. */
  answered?: boolean;
  cta?: { label: string; disabled?: boolean; coin?: boolean };
  locked?: boolean;
  /** the lock-in animation overlay (carried into every mode). */
  locking?: boolean;
  readOnly?: boolean;
  /** FOX PIT face-side: baked card image (card_front_single.png). When set, replaces the code header. */
  faceImage?: string;
  /** How options render. "button" (default) = tappable pick buttons. "plain" = read-only list rows
   *  (no button chrome, not tappable-looking) — used where the card is for READING only, e.g. the
   *  Fox Pit DEAL opened card, where answering happens later. Opt-in; every other caller is unchanged. */
  /** "button" (default binary), "plain" (read-only list), "contest" (N options; 3–4 wrap to a 2×2,
   *  each with its context lines), "chips" (compact bucket chips, no context). */
  pickStyle?: "button" | "plain" | "contest" | "chips";
  onPick?: (legIndex: number, pickIndex: number) => void;
  onStake?: (stake: number) => void;
  onCta?: () => void;
}

function currencyLabel(currency: CardCurrency, amount: number): string {
  return currency === "cash" ? `$${amount}` : `${amount} ⛃`;
}

export function SlateCard({
  mode, currency, catColor, legs,
  eyebrow, title, sub,
  stakeMode = "always", stakeOptions = [], selectedStake = null, stakeLabel = "Play", stakeNote, answered = false,
  cta, locked = false, locking = false, readOnly = false, faceImage, pickStyle = "button",
  onPick, onStake, onCta,
}: SlateCardProps) {
  const stakeVisible = stakeMode !== "none" && stakeOptions.length > 0;
  const stakeGated = stakeMode === "afterAnswers" && !answered;

  return (
    <div
      data-mode={mode}
      data-currency={currency}
      className="relative flex flex-col gap-3 overflow-hidden rounded-[22px] bg-surface-card p-[17px]"
      style={{ border: `2px solid ${catColor}`, boxShadow: SH.card }} // category bezel + card depth
    >
      {/* HEADER — Fox Pit keeps its baked image face (wordmark baked in); the slate's own category +
          title overlay it (sans-serif per the reference). Every other mode uses the code eyebrow/title. */}
      {faceImage ? (
        <div className="relative -mx-[17px] -mt-[17px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-face-image src={faceImage} alt="" className="block w-full" />
          <div className="absolute inset-0 flex flex-col px-2 pt-[27%] text-left">
            {eyebrow && (
              // 3.2: tighter + wrapping so long categories (e.g. ENTERTAINMENT) don't clip.
              <div data-eyebrow className="break-words text-[9px] font-bold uppercase leading-tight" style={{ color: catColor }}>{eyebrow}</div>
            )}
            {title && <div data-title className="text-sm font-semibold leading-tight text-white">{title}</div>}
          </div>
        </div>
      ) : (
        <div>
          {eyebrow && (
            <div data-eyebrow className="text-[13px] font-semibold tracking-[0.11em]" style={{ color: catColor }}>{eyebrow}</div>
          )}
          {/* TITLE — sans-serif semibold, NOT serif. */}
          {title && <div data-title className="mt-1 text-[26px] font-semibold leading-[1.15] tracking-[-0.015em] text-white">{title}</div>}
          {sub && <div className="-mt-1 text-sm text-muted">{sub}</div>}
        </div>
      )}

      {legs.map((leg, li) => {
        const legPickStyle = leg.pickStyle ?? pickStyle; // per-leg override (mixed archetypes)
        return (
        <div
          key={li}
          data-leg-state={leg.state}
          className="rounded-[15px] bg-surface p-4"
          style={{
            boxShadow: SH.rise, // raised leg panel
            outline: leg.state === "ok" ? `2px solid ${catColor}` : leg.state === "bad" ? "2px solid #E0432C" : undefined,
            outlineOffset: leg.state !== "neutral" ? "2px" : undefined,
          }}
        >
          <div className="text-[19px] font-semibold leading-[1.3] text-white">{leg.question}</div>
          {leg.qs && <div className="mt-1.5 text-sm text-muted">{leg.qs}</div>}

          <div className={cn(
            "mt-3.5 gap-2.5",
            legPickStyle === "chips" ? "flex flex-wrap"
              : legPickStyle === "contest" && leg.picks.length > 2 ? "grid grid-cols-2" // 3–4 options wrap to a 2×2
              : "grid",
          )}>
            {leg.picks.map((pick, pi) =>
              legPickStyle === "chips" ? (
                // compact bucket chip (milestone COUNT) — a count/label, no context lines.
                <button
                  key={pi}
                  type="button"
                  data-pick
                  data-selected={pick.selected ? "true" : "false"}
                  disabled={readOnly || locked}
                  onClick={() => onPick?.(li, pi)}
                  className="rounded-full border px-4 py-2 text-[15px] font-semibold"
                  style={{
                    borderColor: pick.selected ? catColor : "#262E3A",
                    borderWidth: pick.selected ? 1.5 : 1,
                    background: pick.selected ? catColor : "#181E27",
                    color: pick.selected ? "#fff" : "#E7E7EB",
                    boxShadow: pick.selected ? SH.chipOn : SH.pick,
                  }}
                >
                  {pick.label}
                  {pick.result && <span className={cn("ml-1.5 text-xs", pick.result === "correct" ? "text-cash" : "text-loss")}>{pick.result === "correct" ? "✓" : "✗"}</span>}
                </button>
              ) : legPickStyle === "plain" ? (
                // READ-ONLY list row — no button chrome (no gradient/border-box/shadow), not tappable.
                // A dashed dot marks it as one of the choices you'll answer LATER, not a live control.
                <div key={pi} data-pick data-readonly="true" className="flex cursor-default items-start gap-2.5 px-1 py-1.5">
                  <span aria-hidden className="mt-[3px] h-2 w-2 flex-none rounded-full border" style={{ borderColor: catColor }} />
                  <span className="min-w-0">
                    <span className="block text-[16px] font-medium leading-tight text-foreground">{pick.label}</span>
                    {(pick.secondary ?? []).map((s, si) => (
                      <span key={si} className="mt-1 block text-[13px] leading-snug text-muted">{s}</span>
                    ))}
                    {pick.result && (
                      <span className={cn("mt-1 block text-sm font-semibold", pick.result === "correct" ? "text-cash" : "text-loss")}>
                        {pick.result === "correct" ? "✓ correct" : "✗ wrong"}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <button
                  key={pi}
                  type="button"
                  data-pick
                  data-selected={pick.selected ? "true" : "false"}
                  disabled={readOnly || locked}
                  onClick={() => onPick?.(li, pi)}
                  className="rounded-[11px] border px-3.5 py-3 text-left"
                  style={{
                    borderColor: pick.selected ? catColor : "#262E3A",
                    borderWidth: pick.selected ? 1.5 : 1,
                    backgroundColor: "#181E27",
                    backgroundImage: PICK_GRADIENT,
                    boxShadow: pick.selected ? SH.pickSel : SH.pick, // gradient + inset highlight; selected adds a ring
                  }}
                >
                  <span className="block text-[17px] font-semibold leading-tight text-white">{pick.label}</span>
                  {(pick.secondary ?? []).map((s, si) => (
                    <span key={si} className="mt-1.5 block text-[14px] leading-snug text-muted">{s}</span>
                  ))}
                  {pick.result && (
                    <span className={cn("mt-1 block text-sm font-semibold", pick.result === "correct" ? "text-cash" : "text-loss")}>
                      {pick.result === "correct" ? "✓ correct" : "✗ wrong"}
                    </span>
                  )}
                </button>
              ),
            )}
          </div>

          {/* display-only context strip (never a threshold) — present for sports slates, omitted for
              Fox Pit trivia which has no such context. */}
          {leg.context && (
            <div data-context className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
              <span>Season avg: {leg.context.seasonAverage}</span>
              <span>Last 3: {leg.context.last3Form}</span>
              <span>{leg.context.matchupNote}</span>
            </div>
          )}

          {leg.flag && (
            <div
              data-flag={leg.flag.variant}
              className="mt-2 rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug"
              style={{ borderColor: leg.flag.variant === "ok" ? "#2FB98A" : "#E0432C", color: leg.flag.variant === "ok" ? "#3ECFA0" : "#E0432C" }}
              dangerouslySetInnerHTML={{ __html: leg.flag.message }}
            />
          )}
        </div>
        );
      })}

      {/* STAKE — per card, at the bottom. stakeMode drives visibility; afterAnswers gates on `answered`. */}
      {stakeVisible && stakeGated && (
        <div data-stake-hint className="text-center text-[13.5px] font-semibold" style={{ color: catColor }}>
          {stakeLabel === "Play" ? "Answer every question to set your stake" : stakeLabel}
        </div>
      )}
      {stakeVisible && !stakeGated && (
        <div
          data-stake-footer
          className="flex flex-wrap items-center justify-center gap-2"
          style={stakeMode === "afterAnswers" ? { borderTop: `1px dashed ${catColor}`, paddingTop: 13 } : undefined}
        >
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{stakeLabel}</span>
          {stakeOptions.map((s) => {
            const on = selectedStake === s;
            return (
              <button
                key={s}
                type="button"
                data-stake={s}
                disabled={readOnly || locked}
                onClick={() => onStake?.(s)}
                className="min-w-[44px] rounded-[10px] border px-3.5 py-2 text-center text-[15px] font-semibold"
                style={{
                  borderColor: on ? "#FC3E01" : "#262E3A",
                  backgroundColor: on ? "#FC3E01" : "#181E27",
                  backgroundImage: on ? undefined : PICK_GRADIENT,
                  color: on ? "#fff" : "#E7E7EB",
                  boxShadow: on ? SH.chipOn : SH.pick, // raised chip; selected = solid + inset highlight
                }}
              >
                {currencyLabel(currency, s)}
              </button>
            );
          })}
          {stakeNote && <span className="w-full text-center text-[12.5px] text-muted">{stakeNote}</span>}
        </div>
      )}

      {/* CTA — solid fill, inset highlight, coloured drop shadow. */}
      {cta && (
        <button
          type="button"
          data-cta
          disabled={cta.disabled || readOnly}
          onClick={() => onCta?.()}
          className="w-full rounded-[13px] p-[17px] text-[17px] font-bold"
          style={
            cta.disabled
              ? { backgroundColor: "#1F262F", backgroundImage: "linear-gradient(180deg,#242C36,#1A212A)", color: "#6E7684", boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)" }
              : { backgroundColor: "#FC3E01", color: cta.coin ? "#062018" : "#fff", boxShadow: SH.cta }
          }
        >
          {cta.label}
        </button>
      )}

      {/* LOCK-IN animation overlay — carried into every mode. */}
      {locking && (
        <div data-lockfx className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3.5" style={{ background: "rgba(8,9,12,.9)" }}>
          <LockGlyph size={84} />
          <div className="text-[14px] font-bold uppercase tracking-[0.16em]" style={{ color: "#FC3E01" }}>Locked in</div>
        </div>
      )}
    </div>
  );
}
