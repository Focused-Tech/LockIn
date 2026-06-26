"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { TourOverlay } from "./TourOverlay";
import {
  isExplore,
  isSlate,
  TOUR_INDEX,
  TOUR_STEPS,
  type TourStep,
} from "./tourSteps";
import { saveTourState } from "./actions";

/**
 * Guided first-pick tour. Mounted once in the /app layout (sibling to the page),
 * so it survives client navigation and can walk the user across routes:
 * welcome → tap a contest → pick → choose entry → submit → confirmation.
 *
 * Advancing is mostly DOM-driven (no coupling to the pages): "action" steps move
 * on when the user actually taps the spotlighted element. Progress is persisted
 * to the user doc so the tour resumes where they left off.
 */
export function GuidedTour({ initialStep }: { initialStep: number }) {
  const pathname = usePathname();
  const [step, setStep] = useState(
    Math.min(Math.max(initialStep, 0), TOUR_STEPS.length - 1),
  );
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const scrolledFor = useRef<number>(-1);

  useEffect(() => setMounted(true), []);

  const persist = useCallback((next: number) => {
    saveTourState({ step: next }).catch(() => {});
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next >= TOUR_STEPS.length) {
        setDone(true);
        saveTourState({ completed: true }).catch(() => {});
        return;
      }
      setStep(next);
      persist(next);
    },
    [persist],
  );

  const skip = useCallback(() => {
    setDone(true);
    saveTourState({ completed: true }).catch(() => {});
  }, []);

  // Which step to actually display on this route. When the user wanders back to
  // Explore mid-slate-flow, funnel them via the "tap a contest" step without
  // losing their stored position.
  const stored = TOUR_STEPS[step];
  let displayIndex = step;
  if (stored && !stored.match(pathname)) {
    if (isExplore(pathname) && step > TOUR_INDEX.card && step < TOUR_INDEX.done) {
      displayIndex = TOUR_INDEX.card;
    } else {
      displayIndex = -1; // not on this step's route → hidden
    }
  }
  const active = !done && displayIndex >= 0;
  const current: TourStep | null = active ? TOUR_STEPS[displayIndex]! : null;

  // Auto-advance: reaching a slate from welcome/card moves into the pick flow.
  useEffect(() => {
    if (done) return;
    if (isSlate(pathname) && step < TOUR_INDEX.predictions) {
      goTo(TOUR_INDEX.predictions);
    }
  }, [pathname, step, done, goTo]);

  // Measure the spotlight target (and detect submit → confirmation) on a light
  // loop so the ring tracks layout, scrolling, and elements that appear later.
  useEffect(() => {
    if (!active || !current) {
      setRect(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      // Submit step advances once the locked-in confirmation card appears.
      if (
        current.key === "submit" &&
        document.querySelector('[data-tour="entry-confirmation"]')
      ) {
        goTo(TOUR_INDEX.done);
        return;
      }

      if (!current.target) {
        setRect(null);
      } else {
        const el = document.querySelector<HTMLElement>(
          `[data-tour="${current.target}"]`,
        );
        if (el) {
          if (scrolledFor.current !== displayIndex) {
            scrolledFor.current = displayIndex;
            el.scrollIntoView({ block: "center", behavior: "smooth" });
          }
          setRect(el.getBoundingClientRect());
        } else {
          setRect(null);
        }
      }
      raf = window.setTimeout(tick, 120) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [active, current, displayIndex, goTo]);

  if (!mounted || !active || !current) return null;
  // Target steps wait for the element; centered steps render immediately.
  if (current.target && !rect) return null;

  return createPortal(
    <TourOverlay
      step={current}
      index={displayIndex}
      total={TOUR_STEPS.length}
      rect={rect}
      showNext={current.advance === "next"}
      onNext={() => goTo(step + 1)}
      onSkip={skip}
    />,
    document.body,
  );
}
