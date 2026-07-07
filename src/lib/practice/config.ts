/**
 * PRACTICE MODE — TUNABLE CONFIG (single source of truth).
 *
 * Every threshold, band, and frequency lives here so they can be retuned against
 * real player data WITHOUT a code change. PLAY-MONEY ONLY: practice coins are
 * SCORE — never cashable, transferable, purchasable-with, or redeemable; they
 * buy nothing and share no value with real-money slates.
 */

export type PracticeTierKey = "rookie" | "sharp" | "pro" | "elite" | "legend";

export const PRACTICE_CONFIG = {
  /** EARNED rank tiers by LIFETIME practice coins (status, not purchase). The
   *  `max` of each tier is derived as the next tier's `min` − 1 (Legend = ∞). */
  tiers: [
    { key: "rookie", label: "Rookie", min: 0, blurb: "Learning the board" },
    { key: "sharp", label: "Sharp", min: 1_000, blurb: "Reading the lines" },
    { key: "pro", label: "Pro", min: 5_000, blurb: "Finding the edges" },
    { key: "elite", label: "Elite", min: 25_000, blurb: "Beating the traps" },
    { key: "legend", label: "Legend", min: 100_000, blurb: "Top of the board" },
  ] as { key: PracticeTierKey; label: string; min: number; blurb: string }[],

  /** Per-tier base difficulty + the [min,max] leg band the dynamic tune may use. */
  difficulty: {
    rookie: { legs: 3, bounds: [3, 3], lineStyle: "easy lines with clear-favorite props (one side ~70%+)" },
    sharp: { legs: 4, bounds: [3, 4], lineStyle: "tighter lines, modest favorites (~58–68%)" },
    pro: { legs: 5, bounds: [5, 5], lineStyle: "coin-flip props and subtle edges (~50–58%)" },
    elite: { legs: 6, bounds: [5, 6], lineStyle: "sharp lines with at least one correlated-trap pair" },
    legend: { legs: 7, bounds: [7, 7], lineStyle: "brutal lines, maximal leg independence, no easy outs" },
  } as Record<PracticeTierKey, { legs: number; bounds: [number, number]; lineStyle: string }>,

  /** DYNAMIC difficulty: keep each player inside this win-rate band (flow channel).
   *  Above `high` → nudge harder; below `low` → nudge easier. */
  winRateBand: { low: 0.4, high: 0.55 },
  /** Rolling window (recent entries) used to estimate a player's win rate. */
  recentWindow: 10,

  /** Sharp Score percentile shown passively per tier ("top X% of predictors"). */
  sharpPercentile: { rookie: 60, sharp: 30, pro: 12, elite: 4, legend: 1 } as Record<
    PracticeTierKey,
    number
  >,

  /** Funnel-to-paid nudge — earned + rare, never naggy. */
  nudge: {
    /** Eligible at this tier index or higher (0=Rookie … 2=Pro). */
    minTierIndex: 2,
    /** …OR on a win streak of at least this length. */
    streakAt: 4,
    /** Show at most this many times per session (client-enforced). */
    perSessionCap: 1,
  },

  /** Coin (SCORE) economy — play-money only. Coins are NEVER purchasable with
   *  real money. The refill is a DAILY free top-up (wait, not instant). */
  coins: {
    start: 500,
    /** At/under this balance the player is "busted" and waits for the daily refill. */
    refillThreshold: 0,
    /** Free daily top-up amount. */
    refillTo: 500,
    /** Hours to wait after busting before the free refill is available. */
    refillCooldownHours: 24,
    defaultStake: 50,
  },

  /** Win-up-to multiplier by leg count (index = legs). Variable-reward curve. */
  perfectMultiplier: [0, 2, 4, 8, 16, 28, 48, 80],

  /** Audio (engagement layer). SFX + background music are independent toggles. */
  audio: {
    /** Defaults (the persisted user pref overrides these). */
    sfxDefaultOn: true,
    musicDefaultOn: false,
    /** SFX volume (0–1). */
    sfxVolume: 0.6,
    /** Looping background-music volume, and the lowered volume while an SFX ducks it. */
    musicVolume: 0.35,
    duckVolume: 0.12,
    /** How long the music stays ducked after an SFX (ms). */
    duckMs: 350,
    /** "Leg added" pitch climbs by this playbackRate step per leg (combo momentum). */
    legAddPitchStep: 0.07,
    /** Card deal-in stagger per card (ms) and the lock-imminent threshold (ms). */
    dealStaggerMs: 50,
    lockingSoonMs: 60_000,
    /** SETTLEMENT REVEAL: beat between each leg landing (ms) and the rising-tick
     *  pitch climb per leg — anticipation builds, the deciding leg lands last. */
    revealBeatMs: 300,
    revealMaxTotalMs: 2_100,
    revealPitchStep: 0.08,
    /** SLATE LOCK-IN: per-leg "seal" stagger + the minimum time the seal flourish
     *  is shown before the settlement reveal takes over (so it's always felt). */
    sealStaggerMs: 55,
    sealMinMs: 620,
  },

  /** AI-SIMULATED creators (training opponents that seed the arena before real
   *  creators exist). The label is CLEAR + honestly framed — never disguised as a
   *  real person — and its prominence is tunable here. */
  aiCreators: {
    /** Short tag shown on cards/host lines. */
    label: "AI",
    /** Expanded, positive framing. */
    labelLong: "AI training opponent",
    tagline: "Sharpen your reads against our AI before you face real creators.",
    /** Tag prominence: "badge" = clear pill (default), "subtle" = muted text.
     *  CLEAR by design so players always know AI vs (future) real creators. */
    labelStyle: "badge" as "badge" | "subtle",
  },

  /** COLORED LEGS — vivid difficulty palette (escalates teal → amber → cayenne).
   *  Avoids win-green / loss-red / select-cayenne-fill collisions; cayenne marks
   *  the hardest legs (on-brand "spicy"). Contrast-checked on the #0A0D12 bg. */
  legColors: {
    easy: { label: "Easy", color: "#2DD4BF", bg: "rgba(45,212,191,0.10)", border: "rgba(45,212,191,0.55)" },
    medium: { label: "Medium", color: "#F5A623", bg: "rgba(245,166,35,0.10)", border: "rgba(245,166,35,0.55)" },
    hard: { label: "Hard", color: "#FF6A3D", bg: "rgba(255,106,61,0.12)", border: "rgba(255,106,61,0.6)" },
  } as Record<"easy" | "medium" | "hard", { label: string; color: string; bg: string; border: string }>,

  /** URGENCY — countdown + spot race. A visible clock ticks toward lock; LABELED
   *  mock players (training bots) claim the top spots one by one as it winds down,
   *  so hesitating costs good spots. The spot the player lands in scales their
   *  payout (SCORE only) via spotBonus. All values tunable; spots capped at 3. */
  urgency: {
    enabled: true,
    /** Total countdown length (ms) from contest creation to lock. */
    countdownMs: 75_000,
    /** Hard cap on filled top spots (the mechanic never fills more than this). */
    maxSpots: 3,
    /** Number of distinct labeled mock players that can claim spots (≤ roster). */
    mockPlayerCount: 3,
    /** Elapsed-fraction (0–1) at which the best OPEN spot gets claimed by a mock —
     *  one entry per spot, top spot first. Length must equal maxSpots. Front/back
     *  loading the curve here tunes how fast good spots vanish. */
    spotFillFracs: [0.38, 0.62, 0.84],
    /** Payout (winnings) multiplier for landing spot 1 / 2 / 3 (else 1.0). The
     *  earlier you lock, the higher the spot, the bigger the score bonus. */
    spotBonus: [1.6, 1.3, 1.12],
    /** Remaining-ms threshold at which the clock turns urgent (pulse + tick). */
    urgentMs: 20_000,
    /** Pulse period bounds as the clock quickens toward zero (ms). */
    pulseSlowMs: 1_000,
    pulseFastMs: 320,
    /** Min remaining-ms gap between urgency "tick" SFX (throttle near zero). */
    tickEveryMs: 1_000,
  },

  /** ARENA — the Parlay round: select several slates, play them back-to-back,
   *  then a batched reveal in event-time order. All timings tunable here. */
  arena: {
    /** Max slates a single round may bundle (keeps a round bounded + snappy). */
    maxSlates: 6,
    /** Pause between finishing one slate and the next dealing in (ms). */
    interSlateCountdownMs: 5_000,
    /** Suspense countdown before each reveal fires (ms) — the "3…2…1" beat.
     *  Kept in the 5–10s design band; per-tick cadence derived from it. */
    revealSuspenseMs: 6_000,
    /** Ticks shown in the suspense countdown (e.g. 3 → "3…2…1"). */
    revealSuspenseTicks: 3,
    /** Synthetic event-time spread: selected slates are staggered this far apart
     *  (ms) so "reveal in event-time order" has a well-defined ordering even
     *  though practice slates settle instantly. */
    eventTimeStepMs: 30 * 60_000,
  },
} as const;
