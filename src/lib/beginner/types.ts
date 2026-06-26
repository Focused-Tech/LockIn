/**
 * Serializable DTOs for the beginner journey (server → client). No Firestore
 * Timestamps (millis only) and no server-only imports, so these are browser-safe.
 */

/** A single yes/no pick the user can call, built from a real prediction. */
export interface BeginnerPick {
  slateId: string;
  predictionId: string;
  question: string;
  /** "Yes" side label (optionA) and "No" side label (optionB). */
  optionA: string;
  optionB: string;
  /**
   * "% agree" shown to the user. NOTE: this is currently the AI probability
   * (optionAProbability / optionBProbability) reframed as plain-language "agree",
   * because there is no community-vote aggregation in the schema yet. Flagged as
   * a semantic stub, not real crowd data.
   */
  agreeA: number;
  agreeB: number;
  lockTimeMs: number;
}

/** A creator-anchored beginner card: who's calling it, plus their open picks. */
export interface BeginnerCard {
  creatorId: string | null;
  /** Display name (creator username, or "LockIn" for house/platform slates). */
  creatorName: string;
  initials: string;
  /**
   * Historical hit-rate (0–100), or null when unknown. Null renders an honest
   * "no track record yet" state — never a fabricated percentage.
   */
  hitRate: number | null;
  /** True for platform-curated (creatorId null) cards anchored to the house. */
  isHouse: boolean;
  /** Whether the viewer follows this creator (followed cards sort to the top). */
  isFollowed: boolean;
  /** The headline pick shown on the card. */
  headline: BeginnerPick;
  /** This creator's other open picks — the pool for building a combo. */
  morePicks: BeginnerPick[];
}

export interface BeginnerFeed {
  cards: BeginnerCard[];
}

/** Two uppercase initials from a name (e.g. "Marcus Reed" → "MR"). */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Short "closes" label from a lock time, relative to `nowMs`. */
export function closesLabel(lockTimeMs: number, nowMs: number): string {
  const ms = lockTimeMs - nowMs;
  if (ms <= 0) return "closing";
  const hours = ms / 3_600_000;
  if (hours < 1) return `closes in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (hours < 24) return `closes in ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "closes tomorrow" : `closes in ${days}d`;
}
