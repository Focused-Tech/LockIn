/** Guided first-pick tour — step definitions. Copy is sentence case, ≤ 2 lines. */

export interface TourStep {
  key: string;
  title: string;
  /** Body copy — keep to two short lines. */
  body: string;
  /** data-tour value of the element to spotlight, or null for a centered step. */
  target: string | null;
  /** Does this step belong on the current route? */
  match: (pathname: string) => boolean;
  /**
   * "next"   → show a Next button (user reads, then advances).
   * "action" → no Next; advances when the user does the thing (tap card / submit).
   */
  advance: "next" | "action";
}

const onExplore = (p: string) => p === "/app";
const onSlate = (p: string) => p.startsWith("/app/slate/");

export const TOUR_STEPS: TourStep[] = [
  {
    key: "welcome",
    title: "Welcome to LockIn",
    body: "Let's make your first pick — it takes about a minute.",
    target: null,
    match: onExplore,
    advance: "next",
  },
  {
    key: "card",
    title: "Pick a contest",
    body: "Tap any contest to open it. Your first play can be free.",
    target: "event-card",
    match: onExplore,
    advance: "action",
  },
  {
    key: "predictions",
    title: "Make your calls",
    body: "Tap an option on each question. AI shows the odds — you decide.",
    target: "prediction-options",
    match: onSlate,
    advance: "next",
  },
  {
    key: "entry",
    title: "Choose how to play",
    body: "Play free with coins, or enter a paid tier for cash prizes.",
    target: "entry-mode",
    match: onSlate,
    advance: "next",
  },
  {
    key: "submit",
    title: "Lock it in",
    body: "Submit your entry to join the contest.",
    target: "submit-entry",
    match: onSlate,
    advance: "action",
  },
  {
    key: "done",
    title: "You're in",
    body: "When the event ends, correct picks win — we settle and pay out automatically.",
    target: null,
    match: onSlate,
    advance: "next",
  },
];

export const TOUR_INDEX = {
  card: TOUR_STEPS.findIndex((s) => s.key === "card"),
  predictions: TOUR_STEPS.findIndex((s) => s.key === "predictions"),
  submit: TOUR_STEPS.findIndex((s) => s.key === "submit"),
  done: TOUR_STEPS.findIndex((s) => s.key === "done"),
};

export const isExplore = onExplore;
export const isSlate = onSlate;
