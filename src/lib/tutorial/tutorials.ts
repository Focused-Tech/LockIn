/**
 * TUTORIAL — SHELL + VERSIONED DATA (§4). The tutorial fires ONCE after onboarding, for the mode the
 * user selected. Its first screen is the Locksmith at her desk (Skip or continue). The COPY lives
 * here as versioned DATA — a wording change is a data change, never a code change. A TUTORIAL_VERSION
 * bump re-offers every mode's tutorial.
 *
 * Slots exist for every mode but are EMPTY on purpose — the architect is approving the copy
 * separately and it will arrive as data. Each empty slot renders an HONEST placeholder (below),
 * never lorem, never invented rules.
 */
export const TUTORIAL_VERSION = "v1";

/** Slot keys — one per mode (§4). */
export const TUTORIAL_MODES = [
  "advanced",
  "beginner",
  "creator",
  "lone_fox", // practice / Lone Fox
  "tower_boss", // Fox Pit tower boss journey
] as const;
export type TutorialMode = (typeof TUTORIAL_MODES)[number];

/** One tutorial's content. `steps` is empty until the architect's copy lands as data. */
export interface TutorialSlot {
  mode: TutorialMode;
  /** Human label for the mode (UI chrome only — not gameplay copy). */
  modeLabel: string;
  /** Ordered walkthrough steps. EMPTY until copy arrives. */
  steps: string[];
}

/** Shown in any empty slot — honest, not invented rules. */
export const TUTORIAL_PLACEHOLDER =
  "The Locksmith's walkthrough for this mode is on its way. For now, she's here — ask her anything about how it works.";

export const TUTORIALS: Record<TutorialMode, TutorialSlot> = {
  advanced: { mode: "advanced", modeLabel: "Advanced", steps: [] },
  beginner: { mode: "beginner", modeLabel: "Beginner", steps: [] },
  creator: { mode: "creator", modeLabel: "Creator", steps: [] },
  lone_fox: { mode: "lone_fox", modeLabel: "Lone Fox (practice)", steps: [] },
  tower_boss: { mode: "tower_boss", modeLabel: "Fox Pit tower — boss journey", steps: [] },
};

/** Map the persisted journey lane to a tutorial mode (advanced is the default lane). */
export function laneToTutorialMode(lane: string | null | undefined): TutorialMode {
  return lane === "beginner" ? "beginner" : "advanced";
}

/** The per-user, per-mode record (same shape family as the creator agreement signature). */
export interface TutorialRecord {
  mode: TutorialMode;
  version: string;
  seen: boolean;
  seenAt?: number;
}

/**
 * Has THIS mode's tutorial been seen at the CURRENT version? A version bump (record.version behind
 * TUTORIAL_VERSION) returns false → the tutorial is re-offered.
 */
export function isTutorialSeen(rec: TutorialRecord | null | undefined): boolean {
  return !!rec && rec.seen === true && rec.version === TUTORIAL_VERSION;
}
