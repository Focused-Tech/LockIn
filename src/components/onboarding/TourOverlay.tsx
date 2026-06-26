"use client";

import type { TourStep } from "./tourSteps";

const BLUE = "#3B8BFF";
const DIM = "rgba(10,13,18,0.74)";
const SPOTLIGHT_PAD = 8;

/**
 * Renders the dim/spotlight + the step tooltip. Spotlighted targets stay clickable
 * (the spotlight ring is pointer-events:none); only the tooltip captures input.
 */
export function TourOverlay({
  step,
  index,
  total,
  rect,
  showNext,
  onNext,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  rect: DOMRect | null;
  showNext: boolean;
  onNext: () => void;
  onSkip: () => void;
}) {
  const tooltip = (
    <div
      style={{ pointerEvents: "auto" }}
      className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[rgba(59,139,255,0.4)] bg-[#0e1722] p-4 shadow-2xl"
    >
      <p className="text-sm font-semibold" style={{ color: BLUE }}>
        {step.title}
      </p>
      <p className="mt-1 text-sm leading-snug text-foreground">{step.body}</p>

      <div className="mt-3 flex items-center justify-between">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 16 : 6,
                backgroundColor: i === index ? BLUE : "rgba(107,122,142,0.5)",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted hover:text-foreground"
          >
            Skip tour
          </button>
          {showNext ? (
            <button
              type="button"
              onClick={onNext}
              className="rounded border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.12)] px-3 py-1.5 text-sm font-medium"
              style={{ color: BLUE }}
            >
              {index === total - 1 ? "Finish" : "Next"}
            </button>
          ) : (
            <span className="text-xs italic" style={{ color: BLUE }}>
              {step.key === "card" ? "Tap a contest" : "Tap lock in"}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Centered step (no target): full dim backdrop + centered tooltip.
  if (!rect) {
    return (
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        style={{ backgroundColor: DIM, pointerEvents: "auto" }}
      >
        {tooltip}
      </div>
    );
  }

  // Spotlight: a ring at the target with a giant box-shadow dimming everything else.
  const top = rect.top - SPOTLIGHT_PAD;
  const left = rect.left - SPOTLIGHT_PAD;
  const width = rect.width + SPOTLIGHT_PAD * 2;
  const height = rect.height + SPOTLIGHT_PAD * 2;

  // Place the tooltip below the target, or above when it's low on screen.
  const below = rect.bottom + 12;
  const placeAbove = rect.bottom > window.innerHeight * 0.62;
  const tooltipTop = placeAbove ? undefined : below;
  const tooltipBottom = placeAbove ? window.innerHeight - rect.top + 12 : undefined;

  return (
    <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "fixed",
          top,
          left,
          width,
          height,
          borderRadius: 12,
          border: `2px solid ${BLUE}`,
          boxShadow: `0 0 0 9999px ${DIM}`,
          transition: "all 0.2s ease",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: tooltipTop,
          bottom: tooltipBottom,
          left: Math.max(16, Math.min(left, window.innerWidth - 336)),
        }}
      >
        {tooltip}
      </div>
    </div>
  );
}
