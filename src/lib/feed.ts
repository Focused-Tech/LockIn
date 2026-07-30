import type {
  EntryTierConfig,
  PredictionType,
  SlateStatus,
} from "@/lib/firebase/types";

/**
 * Serializable feed DTOs passed from server components to client components and
 * returned by the slates tRPC router. No Firestore Timestamps (use millis) and
 * no server-only imports, so these are safe in the browser.
 */
export interface FeedPrediction {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  probA: number;
  probB: number;
  type: PredictionType;
  line: number | null;
  /** Resolved outcome once settled, else null. */
  result: string | null; // §2.1 widened — archetype legs resolve to an option key, not just "a"/"b"
  /** §1 cross-game (archetype) fields — present only for pro predictions. The picker renders these
   *  N options (not the binary A/B), each with its feed context (season avg + last-out). */
  archetype?: string;
  gameLine?: string | null;
  options?: ProPickOption[];
  /** §1.2 — set when player stats couldn't load; the picker shows a visible error, never a blank. */
  contextError?: string | null;
}

export interface ProPickOption {
  key: string;
  label: string;
  seasonAverage?: string;
  last3Form?: string;
}

export interface FeedSlate {
  id: string;
  title: string;
  category: string;
  status: SlateStatus;
  creatorId: string | null;
  entryTiers: EntryTierConfig[];
  entryCount: number;
  isCardRush: boolean;
  rushMultiplier: number;
  maxEntries: number | null;
  lockTimeMs: number;
  predictions: FeedPrediction[];
}

/** Statuses shown in the Explore feed. */
export const FEED_STATUSES: SlateStatus[] = ["live", "locked"];
