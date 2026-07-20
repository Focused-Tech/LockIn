"use client";

import { DOOR_EMBLEM } from "@/lib/foxpit";

/**
 * Fox Pit SLATE CARD — FRONT (built live in code, per the ALL IN design ref and
 * the cards Boss Fox holds on the Parlay lone-journey path).
 *
 * Brand-token only (no raw hex): dark card on `surface-card`, orange `accent`
 * fox-crest header + linework, thin `accent` dividers. ZERO baked text — every
 * matchup row is rendered from `matchups` data.
 *
 * Reveal: pass `revealed` + `results` (and the player's `picks`). Each row
 * resolves independently — a correct pick snaps to a `win` (green) check, a
 * wrong pick to a `loss` (red) ✗. (Spec named #10B981 for the check; per the
 * no-raw-hex rule this uses the system `win` token #22C55E — the design system's
 * designated "correct pick" green. Swap if you truly want #10B981.)
 *
 * The card BACK stays the existing approved asset — not rendered here.
 */
export type Side = "a" | "b";

export interface SlateMatchup {
  id: string;
  /** the question / matchup line, e.g. "Lakers vs Celtics — winner" */
  question: string;
  optionA: string;
  optionB: string;
}

export function SlateCardFront({
  slateNumber,
  matchups,
  picks,
  results,
  revealed = false,
  width = 320,
}: {
  slateNumber: number | string;
  matchups: SlateMatchup[];
  /** the player's pick per matchup id (optional — blank card omits it) */
  picks?: Record<string, Side>;
  /** actual outcomes per matchup id (drives the reveal) */
  results?: Record<string, Side>;
  revealed?: boolean;
  width?: number;
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-accent/40 bg-surface-card text-foreground shadow-[0_10px_40px_rgba(0,0,0,0.55)]"
      style={{
        width,
        aspectRatio: "5 / 7",
        background:
          "linear-gradient(160deg, #12161E 0%, #0C0F15 55%, #0A0D12 100%)",
      }}
    >
      {/* faint orange inner frame — the fine linework on the reference cards */}
      <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-accent/20" />

      {/* header: fox crest + LOCKIN wordmark */}
      <div className="relative flex items-center gap-2 px-4 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DOOR_EMBLEM}
          alt=""
          className="h-7 w-7 shrink-0 object-contain"
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
        />
        <span className="text-lg font-extrabold uppercase tracking-[0.18em] text-accent">
          LockIn
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
          All In
        </span>
      </div>

      {/* SLATE # line */}
      <div className="relative mt-2 flex items-center gap-2 px-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-accent/80">
          Slate #{slateNumber}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-accent/50 to-transparent" />
      </div>

      {/* matchup rows — all content is data-driven */}
      <div className="relative mt-1 flex flex-1 flex-col px-3 py-2">
        {matchups.map((m, i) => {
          const pick = picks?.[m.id];
          const outcome = results?.[m.id];
          const resolved = revealed && outcome != null;
          const correct = resolved && pick != null && pick === outcome;
          const wrong = resolved && pick != null && pick !== outcome;
          const chosenLabel =
            pick === "a" ? m.optionA : pick === "b" ? m.optionB : null;

          return (
            <div key={m.id} className="flex flex-col">
              {i > 0 && (
                /* thin orange divider between matchups */
                <span className="mx-1 h-px bg-accent/15" />
              )}
              <div className="flex items-center gap-2.5 py-2">
                {/* status circle: orange ring → green check / red ✗ on reveal */}
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-black leading-none transition-all duration-300 " +
                    (correct
                      ? "border-win text-win"
                      : wrong
                        ? "border-loss text-loss"
                        : "border-accent/70 text-accent")
                  }
                  style={{ transitionDelay: revealed ? `${i * 120}ms` : "0ms" }}
                  aria-hidden
                >
                  {correct ? "✓" : wrong ? "✗" : ""}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight">
                    {m.question}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] leading-tight text-muted">
                    {chosenLabel ? (
                      <span
                        className={
                          correct
                            ? "text-win"
                            : wrong
                              ? "text-loss"
                              : "text-accent/90"
                        }
                      >
                        {chosenLabel}
                      </span>
                    ) : (
                      <>
                        {m.optionA}
                        <span className="px-1 text-muted/60">vs</span>
                        {m.optionB}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* footer crest strip */}
      <div className="relative flex items-center justify-center gap-1.5 border-t border-accent/20 px-4 py-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted">
          Lock in your picks
        </span>
      </div>
    </div>
  );
}
