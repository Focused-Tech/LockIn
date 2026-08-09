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

/**
 * ADVANCED walkthrough — APPROVED, PINNED steps (published verbatim from
 * ADVANCED_TUTORIAL_COPY_v1_2026-08-08.md). Pinning ends the "odds / over-under / prediction
 * community" drift: the Locksmith renders THESE beats instead of improvising from the seed. Step ids
 * are stable (never renumber): welcome · what_is_a_slate · reading_a_leg · locking_in · entry_and_pool
 * · how_you_get_paid · the_board · playing_it_straight · closing.
 */
export const ADVANCED_STEPS: string[] = [
  "**Welcome to Advanced.**\n\nThis is the real-money side of Lock In. Everything here is a **skill contest** — you're not playing against the house, you're playing against everyone else who entered, and the best cards win the pool.\n\nI'm the Locksmith. I'll walk you through it once. You can skip any time, and you can ask me anything afterward.",
  "**A slate is a set of legs.**\n\nA creator builds a slate — usually five or six **legs**. Each leg is one question about how players will perform, drawn from different games on the night.\n\nYou answer every leg. Get them all right and you have a **perfect card**.",
  "**Read the leg, read the room.**\n\nEvery leg gives you two or more choices — which player shows out, who leads the field, who gets there first. Under each choice you'll see real context: season averages, recent form, the matchup. That context is free, and it's there so you can actually think.\n\nThe percentages beside each choice show how the room is leaning — how many players have picked that side so far. A choice the room is split on is where the sharp calls live.",
  "**Being right gets you paid. Being fast decides how much.**\n\nWhen your card is set, you **lock in**. Your lock-in time is recorded to the second.\n\nAmong everyone with a perfect card, the earliest locks rank highest. That's the whole edge of this game: a lot of people can be right, but the ones who committed early take the top places. Sit on a card too long and you'll watch someone with the same answers finish above you.\n\nYou can change your answers until you lock. After you lock, the card is yours.",
  "**Two charges, one pot.**\n\nYour **entry stake** goes into the prize pool — that pool is the money everyone plays for. On top of it, the creator charges a small **hosting fee** for running the contest. Two separate things: one funds the prizes, one pays the creator.\n\nThe pool grows as more players enter. What it's paying is shown as a projection while the slate is open, and it becomes a fixed figure the moment the slate closes — before the games start. What you see at close is what's real.",
  "**A lot of people win here.**\n\nPrizes run deep into the field — far deeper than you're used to. Top places take the biggest shares, and it steps down from there through hundreds of places.\n\nTwo things decide where you land: a perfect card gets you into the paid field, and your lock-in time decides how high you place inside it.",
  "**The Board is where you stand.**\n\nYour record lives on the Board — how often you take a slate, and where you rank against everyone else playing at your level. It also carries your **Championship** standing: every slate you win all season builds toward a seat at the finale.\n\nTap the Championship strip any time to read how that works.",
  "**Before you play with money.**\n\nContests are open to eligible players 18 or older, in places where paid skill contests are legal — we check, and we'll tell you plainly if your area isn't covered.\n\nSet your own limits and stick to them. Everything you need is under Responsible Play, and you can set limits before you ever enter a contest.",
  "**That's the whole game.**\n\nRead the legs. Make the calls you actually believe. Lock in early.\n\nI'm on every screen where a decision gets made — tap me for a hint on a leg, or ask me anything about how the app works. Good luck.",
];

/** APPROVED seed prompt (verbatim) — governs the Locksmith's Q&A after the advanced walkthrough. */
export const ADVANCED_SEED =
  "You are the Locksmith, Lock In's in-app guide. You help players understand Lock In's " +
  "skill-based contests, how slates and legs work, how locking in affects placement, how the " +
  "prize pool and the paid field work, account and balance questions, and how to find things in " +
  "the app.\n\n" +
  "VOCABULARY — never use these words: odds, over/under, line, spread, bet, wager, betting, " +
  "bookmaker, sportsbook, parlay, prediction market, gambling. Lock In runs skill contests. Say " +
  "contest, slate, leg, card, lock in, pool, prize, place, entry.\n\n" +
  "NEVER: state Lock In's rake or any house margin · invent a number, a prize figure, a date, or " +
  "a rule that isn't in the app · give advice on which side of a leg to choose in a live " +
  "contest · discuss another platform · claim a contest is available where it isn't.\n\n" +
  "When you don't know something, say so and point to where it lives in the app. Keep answers " +
  "short — two or three sentences unless asked for more. Never write in Markdown; plain " +
  "sentences only.";

export const TUTORIALS: Record<TutorialMode, TutorialSlot> = {
  advanced: {
    mode: "advanced", modeLabel: "Advanced", steps: ADVANCED_STEPS,
    intro: ADVANCED_SEED,
  },
  beginner: {
    mode: "beginner", modeLabel: "Beginner", steps: [],
    intro:
      "I just chose the Beginner journey on Lock In and I'm brand new. Walk me through it simply, step by " +
      "step: that it's coins not cash, how I make my picks in plain language, and how I climb and get " +
      "better. Keep it friendly and short, then invite me to ask you anything before I start playing.",
  },
  creator: {
    mode: "creator", modeLabel: "Creator", steps: [],
    intro:
      "I just chose the Creator journey on Lock In and I'm new to hosting. Walk me through it step by step: " +
      "building a slate, the AI-drafted questions, selling pick packages, and how I earn. Keep it clear and " +
      "concise, then invite me to ask you anything before I start.",
  },
  lone_fox: {
    mode: "lone_fox", modeLabel: "Lone Fox (practice)", steps: [],
    intro:
      "I just entered the Fox Pit practice journey on Lock In and I'm new. Walk me through the Lone Fox run " +
      "step by step: choosing a floor, facing the boss, that it runs on coins, and how I win. Keep it fun " +
      "and short, then invite me to ask you anything before I start playing.",
  },
  tower_boss: {
    mode: "tower_boss", modeLabel: "Fox Pit tower — boss journey", steps: [],
    intro:
      "I just entered the Fox Pit tower boss journey on Lock In and I'm new. Walk me through it step by step: " +
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
