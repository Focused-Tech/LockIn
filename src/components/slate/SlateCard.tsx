"use client";

/**
 * THE UNIFORM SLATE CARD — full card rebuilt to design/lockin_slate_card_mockup.html
 * (sha256 a890d939e6cdc2635752d36e9458c640ef49dd57cc213cf632fda4c7009d8326). The mockup is the SPEC:
 * the full-card DOM + class names match renderCard() there EXACTLY, so the structural gate diffs empty.
 * Styling lives in ./slate-card.css (ported verbatim, literal shadows only — never var()/color-mix()
 * inside a box-shadow, which silently no-op). Depth, two-column picks, name+context-lines, the header
 * (eyebrow/who/badge/title/sub), the category bezel and the entry-at-the-bottom all come from there.
 *
 * ONE component, three render paths: `compact` (Explore feed summary — unchanged), `faceImage`
 * (Fox Pit baked face — unchanged header), and the default full card (this is the rebuilt one).
 */
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { LockAnimation } from "@/components/LockAnimation";
import "./slate-card.css";

export type CardCurrency = "cash" | "coins";
export type LegState = "neutral" | "ok" | "bad";
/** always = stake always shown; afterAnswers = revealed once this card's questions are answered; none = no stake. */
export type StakeMode = "always" | "afterAnswers" | "none";

const SH = {
  card: "0 10px 30px rgba(0,0,0,.5)",
  rise: "inset 0 1px 0 rgba(255,255,255,.045), 0 2px 6px rgba(0,0,0,.45)",
};

export interface SlatePick {
  label: string;
  secondary?: string[];
  selected?: boolean;
  result?: "correct" | "wrong" | null;
  /** which secondary line (1-based) is the category-highlighted one (mockup .cx.hl). */
  highlight?: number;
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
  context?: LegDisplayContext | null;
  flag?: { variant: "ok" | "bad"; message: string } | null;
  /** per-leg pick style: contest (nm + context lines, 2/3-col grid), chips (centered buckets, no
   *  context), lettered (A/B/C/D trivia), plain (read-only list), button (alias of contest). */
  pickStyle?: "button" | "plain" | "contest" | "chips" | "lettered";
}
export interface SlateCardProps {
  mode: string;
  currency: CardCurrency;
  /** category-canon color — drives the bezel (border, --cat). */
  catColor: string;
  legs: SlateLeg[];
  eyebrow?: string;
  title?: string;
  sub?: string;
  /** header top-right badge (mockup .badge) — e.g. "Cash · 44 states" / "Coins · all 50 states". */
  badge?: string;
  /** creator block (mockup .who) — avatar initials + name + track-record line. */
  creator?: { name: string; note?: string; initials?: string; record?: string } | null;
  /** category/status tags under the creator (mockup .tags). */
  tags?: string[];
  tagsMute?: string[];
  /** a plain premise box under the header (mockup .box > p). */
  premise?: string;
  stakeMode?: StakeMode;
  stakeOptions?: number[];
  selectedStake?: number | null;
  stakeLabel?: string;
  stakeNote?: string;
  answered?: boolean;
  cta?: { label: string; disabled?: boolean; coin?: boolean };
  locked?: boolean;
  locking?: boolean;
  readOnly?: boolean;
  faceImage?: string;
  pickStyle?: "button" | "plain" | "contest" | "chips" | "lettered";
  onPick?: (legIndex: number, pickIndex: number) => void;
  onStake?: (stake: number) => void;
  onCta?: () => void;
  /** §2.5 — entry footer content that must live INSIDE the card, below the CTA (cash balance +
   *  geo/attestation affirmation). Rendered as the last children of the card, inside the bezel. */
  footer?: React.ReactNode;
  // ── compact feed state (Explore) — unchanged render path ──
  compact?: boolean;
  status?: "live" | "locked" | "settled";
  reach?: string;
  pool?: { poolLabel: string; firstLabel: string; multipleLabel?: string } | null;
  rush?: { multiplier: number } | null;
  withheld?: boolean;
}

/** currency accent set (mockup COIN/CASH): coins → green accent + gold money; cash → orange accent. */
function currencyVars(currency: CardCurrency): Record<string, string> {
  return currency === "coins"
    ? { "--accent": "#2FB98A", "--money": "#F0C463", "--badge-bg": "#3ECFA0" }
    : { "--accent": "#FC3E01", "--money": "#3ECFA0", "--badge-bg": "#F0C463" };
}
// Mockup stake chips carry the currency in the DATA: cash opts are "$5", coin opts are plain "100".
function currencyLabel(currency: CardCurrency, amount: number): string {
  return currency === "cash" ? `$${amount}` : `${amount}`;
}
/** contest/chips column count: 2 side-by-side (4 wraps to 2×2); 3 → c3 (single column per the mockup
 *  CSS, which defines no .c3 track — RULE 3: the file wins). */
function contestCols(n: number): number {
  return n === 3 ? 3 : 2;
}

export function SlateCard(props: SlateCardProps) {
  const {
    mode, currency, catColor, legs,
    eyebrow, title, sub, badge, creator, tags, tagsMute, premise,
    stakeMode = "always", stakeOptions = [], selectedStake = null, stakeLabel = "Play", stakeNote, answered = false,
    cta, locked = false, locking = false, readOnly = false, faceImage, pickStyle = "contest",
    onPick, onStake, onCta, footer,
    compact = false, status, reach, pool, rush, withheld = false,
  } = props;

  // LOCK-IN AUDIO — public/sounds/lock-close.mp3 (the splash lock sound), fired at ~0.74s to land as
  // the LockAnimation shackle SEATS. Only when locking begins; lock-in is user-initiated (the CTA tap).
  useEffect(() => {
    if (!locking) return;
    let audio: HTMLAudioElement | null = null;
    const t = window.setTimeout(() => {
      audio = new Audio("/sounds/lock-close.mp3");
      audio.play().catch(() => {});
    }, 740);
    return () => { window.clearTimeout(t); audio?.pause(); };
  }, [locking]);

  // ── COMPACT FEED STATE (Explore) — unchanged summary card ──
  if (compact) {
    return (
      <div
        data-mode={mode}
        data-currency={currency}
        data-compact
        data-withheld={withheld ? "true" : undefined}
        className="relative flex flex-col gap-2.5 overflow-hidden rounded-[22px] bg-surface-card p-4"
        style={{ border: `2px solid ${catColor}`, boxShadow: SH.card }}
      >
        <div className="flex items-center justify-between gap-2">
          {eyebrow && (
            <div data-eyebrow className="truncate text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: catColor }}>{eyebrow}</div>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            {rush && !withheld && <span data-rush className="rounded-full bg-rush-soft px-2 py-0.5 text-[10px] font-bold uppercase text-rush">⚡ {rush.multiplier}×</span>}
            {withheld ? (
              <span data-status="withheld" className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-muted" style={{ background: "rgba(107,122,142,.14)" }}>Under review</span>
            ) : status ? (
              <span
                data-status={status}
                className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", status === "live" ? "text-live" : "text-muted")}
                style={{ background: status === "live" ? "rgba(245,166,35,.12)" : "rgba(107,122,142,.14)" }}
              >
                {status}
              </span>
            ) : null}
          </div>
        </div>
        {title && <div data-title className="text-[18px] font-semibold leading-snug text-white">{title}</div>}
        {withheld ? (
          <p className="text-sm text-muted">This contest is under review and isn&apos;t available to play.</p>
        ) : (
          <>
            {creator && (
              <div data-creator className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="font-semibold text-creator">{creator.name}</span>
                {creator.note && <span className="text-muted">· {creator.note}</span>}
              </div>
            )}
            {pool && (
              <div data-pool className="flex items-center justify-between rounded-[13px] bg-surface p-3" style={{ boxShadow: SH.rise }}>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Prize pool</div>
                  <div className="text-lg font-semibold text-cash">{pool.poolLabel}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10px] uppercase tracking-wide text-muted">1st place</div>
                  <div className="text-lg font-semibold text-white">
                    {pool.firstLabel}
                    {pool.multipleLabel && <span className="ml-1 text-sm text-muted">{pool.multipleLabel}</span>}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-[12px]">
              <span className={cn("font-semibold", currency === "coins" ? "text-coins" : "text-cash")}>
                {currency === "coins" ? "Free · coins" : "Cash entry"}
              </span>
              {reach && <span data-reach className="text-muted">{reach}</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── FULL CARD — the mockup structure (div.slate). Wrapper .lockin-slatecard scopes the CSS; the
  //    structural gate compares the .slate subtree. --cat = category bezel; currency vars per COIN/CASH.
  const vars = { "--cat": catColor, ...currencyVars(currency) } as React.CSSProperties;

  return (
    <div className="lockin-slatecard">
      <div className={cn("slate", locking && "locking")} data-mode={mode} data-currency={currency} style={vars}>
        {/* HEADER */}
        {faceImage ? (
          // FOX PIT baked face — image + overlaid eyebrow/title (carve-out; unchanged).
          <div className="relative -mx-[17px] -mt-[17px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-face-image src={faceImage} alt="" className="block w-full" />
            <div className="absolute inset-0 flex flex-col px-2 pt-[27%] text-left">
              {eyebrow && <div className="eyebrow break-words text-[9px]" style={{ color: catColor }}>{eyebrow}</div>}
              {title && <div className="title text-sm leading-tight">{title}</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="top">
              <div className="l">
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                {creator && (
                  <div className="who">
                    <div className="av">{creator.initials ?? creator.name.slice(0, 2).toUpperCase()}</div>
                    <div className="n">
                      <div className="nm">{creator.name}</div>
                      {(creator.record ?? creator.note) && <div className="rec">{creator.record ?? creator.note}</div>}
                    </div>
                    {(tags?.length || tagsMute?.length) ? (
                      <div className="tags">
                        {(tags ?? []).map((t) => <span key={t} className="tag">{t}</span>)}
                        {(tagsMute ?? []).map((t) => <span key={t} className="tag mute">{t}</span>)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {badge && <div className="badge">{badge}</div>}
            </div>
            {title && <div className="title">{title}</div>}
            {sub && <div className="sub">{sub}</div>}
          </>
        )}

        {premise && <div className="box"><p>{premise}</p></div>}

        {/* LEGS */}
        {legs.map((leg, li) => {
          const resolved = leg.pickStyle ?? pickStyle;
          const style: "contest" | "chips" | "lettered" | "plain" = resolved === "button" ? "contest" : resolved;
          const isContest = style === "contest" || style === "chips";
          const cols = isContest ? contestCols(leg.picks.length) : 0;
          const picksClass = cn(
            "picks",
            style === "chips" ? "contest" : style, // chips share the contest grid
            isContest && `c${cols}`,
          );
          return (
            <div key={li} className={cn("leg", leg.state !== "neutral" && "spot")}>
              <div className="q">{leg.question}</div>
              {leg.qs && <div className="qs">{leg.qs}</div>}
              <div className={picksClass}>
                {leg.picks.map((pick, pi) => {
                  const cxLines = pick.secondary ?? [];
                  const bd = (
                    <div className="bd">
                      <div className="nm">{pick.label}</div>
                      {cxLines.map((l, ix) => (
                        <div key={ix} className={cn("cx", pick.highlight && ix === pick.highlight - 1 && "hl")}>{l}</div>
                      ))}
                      {pick.result && (
                        <div className={cn("res", pick.result === "correct" ? "right" : "wrong")}>
                          {pick.result === "correct" ? "✓ correct" : "✗ wrong"}
                        </div>
                      )}
                    </div>
                  );
                  const pickCls = cn("pick", pick.selected && "sel", style === "chips" && "chip");
                  if (style === "plain") {
                    return <div key={pi} className={pickCls} data-pick data-readonly="true">{bd}</div>;
                  }
                  return (
                    <button
                      key={pi}
                      type="button"
                      className={pickCls}
                      data-pick
                      data-selected={pick.selected ? "true" : "false"}
                      disabled={readOnly || locked}
                      onClick={() => onPick?.(li, pi)}
                    >
                      {style === "lettered" && <span className="ltr">{"ABCDEFGH"[pi]}</span>}
                      {bd}
                    </button>
                  );
                })}
              </div>
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

        {/* POOL (advanced/settled) */}
        {pool && (
          <div className="pool">
            <div className="c">
              <div className="k">Prize pool</div>
              <div className="v">{pool.poolLabel}</div>
            </div>
            <div className="c r">
              <div className="k">1st place</div>
              <div className="v">{pool.firstLabel}{pool.multipleLabel && <span className="mx"> {pool.multipleLabel}</span>}</div>
            </div>
          </div>
        )}

        {/* §2.5 — entry footer (cash balance + affirmation) INSIDE the card, ABOVE the stake+cta so
            .stake and .cta remain the last two flow children (the .lockfx overlay excepted). */}
        {footer && <div data-footer>{footer}</div>}

        {/* STAKE — inside the card, at the bottom. afterAnswers gates on `answered`. */}
        {stakeMode !== "none" && stakeOptions.length > 0 && (
          stakeMode === "afterAnswers" && !answered ? (
            <div className="hint calm">{stakeLabel === "Play" || stakeLabel === "Entry" ? "Answer every question to set your stake" : stakeLabel}</div>
          ) : (
            <div className={cn("stake", stakeMode === "afterAnswers" && "reveal")}>
              <span className="lb2">{stakeLabel}</span>
              {stakeOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn("chipb", selectedStake === s && "on")}
                  data-stake={s}
                  disabled={readOnly || locked}
                  onClick={() => onStake?.(s)}
                >
                  {currencyLabel(currency, s)}
                </button>
              ))}
              {stakeNote && <span className="nt">{stakeNote}</span>}
            </div>
          )
        )}

        {/* CTA — solid fill, inset highlight, coloured drop shadow (all from CSS). */}
        {cta && (
          <button
            type="button"
            className={cn("cta", cta.coin && "coin")}
            data-cta
            disabled={cta.disabled || readOnly}
            onClick={() => onCta?.()}
          >
            {cta.label}
          </button>
        )}

        {/* LOCK-IN overlay — the app's LockAnimation (shackle slides straight DOWN into the base + a
            click), the SAME lock used in practice / spot-race. CSS shows the overlay only on
            .slate.locking; LockAnimation mounts only while locking so it plays ONCE, not on page load. */}
        <div className="lockfx" data-lockfx>
          {locking && <LockAnimation size={112} sound={false} />}
          <div className="lw">Locked in</div>
        </div>
      </div>
    </div>
  );
}
