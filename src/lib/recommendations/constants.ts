/** "For you" recommendation weights — must sum to 1. */
export const REC_WEIGHTS = {
  categoryAffinity: 0.35,
  creatorFollow: 0.3,
  tierMatch: 0.15,
  recency: 0.2,
} as const;

/** Category plays at which affinity saturates (a "you play this a lot" signal). */
export const CATEGORY_PLAYS_SATURATION = 5;
/** Recency window: a slate locking within this horizon scores full → zero. */
export const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Below this many candidate slates, fall back to the chronological feed. */
export const REC_MIN_RESULTS = 3;
