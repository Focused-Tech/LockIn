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
  result: "a" | "b" | null;
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
