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
  /** SEED prompt (versioned data) the Locksmith opens the walkthrough with — she answers it live
   *  from her knowledge base, then the user asks follow-ups. The actual rules are AI-generated (not
   *  hardcoded here), so a wording change stays a data change. */
  intro: string;
}

/** Shown in any empty slot — honest, not invented rules. */
export const TUTORIAL_PLACEHOLDER =
  "The Locksmith's walkthrough for this mode is on its way. For now, she's here — ask her anything about how it works.";

export const TUTORIALS: Record<TutorialMode, TutorialSlot> = {
  advanced: {
    mode: "advanced", modeLabel: "Advanced", steps: [],
    intro:
      "I just chose the Advanced journey on LockIn and I'm brand new. Walk me through how it works, " +
      "step by step and in plain language: how to read a slate, how making picks works, how the prize " +
      "pool and entry fee work, and how I actually win. Keep it warm and concise, then invite me to ask " +
      "you anything before I start playing.",
  },
  beginner: {
    mode: "beginner", modeLabel: "Beginner", steps: [],
    intro:
      "I just chose the Beginner journey on LockIn and I'm brand new. Walk me through it simply, step by " +
      "step: that it's coins not cash, how I make my picks in plain language, and how I climb and get " +
      "better. Keep it friendly and short, then invite me to ask you anything before I start playing.",
  },
  creator: {
    mode: "creator", modeLabel: "Creator", steps: [],
    intro:
      "I just chose the Creator journey on LockIn and I'm new to hosting. Walk me through it step by step: " +
      "building a slate, the AI-drafted questions, selling pick packages, and how I earn. Keep it clear and " +
      "concise, then invite me to ask you anything before I start.",
  },
  lone_fox: {
    mode: "lone_fox", modeLabel: "Lone Fox (practice)", steps: [],
    intro:
      "I just entered the Fox Pit practice journey on LockIn and I'm new. Walk me through the Lone Fox run " +
      "step by step: choosing a floor, facing the boss, that it runs on coins, and how I win. Keep it fun " +
      "and short, then invite me to ask you anything before I start playing.",
  },
  tower_boss: {
    mode: "tower_boss", modeLabel: "Fox Pit tower — boss journey", steps: [],
    intro:
      "I just entered the Fox Pit tower boss journey on LockIn and I'm new. Walk me through it step by step: " +
      "climbing the floors, beating each boss to win their key, and how the run works. Keep it exciting and " +
      "concise, then invite me to ask you anything before I start.",
  },
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
