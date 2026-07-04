/**
 * ARENA SESSIONS — the persistence layer that will back Coliseum team play, the
 * AI-rival escalation ladder, and "Run it back" resume.
 *
 * ⚠️ STUB (this pass). Coliseum's team backend is not built yet — see the visible
 * stub at /app/practice/arena/coliseum. The design (approved) is:
 *   Firestore `arenaSessions/{sessionId}` is the SOURCE OF TRUTH (online play,
 *   multiplayer, cross-device, resume), with a localStorage cache keyed by
 *   `ARENA_SESSION_CACHE_KEY` for instant first paint. Do NOT build a
 *   localStorage-only version — this module is the single layer for both.
 *
 * The type + collection name are declared now so the Coliseum work slots in
 * without a schema migration. No live reads/writes happen until that pass.
 */

import type { PracticeTierKey } from "@/lib/practice/tiers";

/** localStorage cache key (fast first paint only; Firestore is source of truth). */
export const ARENA_SESSION_CACHE_KEY = "lockin:arena:session";

export type ArenaSessionMode = "coliseum";

/** Firestore `arenaSessions/{id}` — Coliseum team room + rivalry state. */
export interface ArenaSessionDoc {
  mode: ArenaSessionMode;
  /** Team captain (the user who opened the room). */
  ownerId: string;
  /** Invite codes issued for this room (multiple supported). */
  inviteCodes: string[];
  /** The AI creator being challenged (e.g. `ai_lockinfox`). */
  rivalCreatorId: string;
  /** Rivalry tier — climbs each time the team "runs it back". Drives difficulty. */
  tier: number;
  /** Categories the team agreed for the AI to build from. */
  categories: string[];
  /** Practice tier of the room owner at creation (for slate difficulty). */
  ownerTier: PracticeTierKey;
  createdAtMillis: number;
  updatedAtMillis: number;
}

/** Not implemented yet — Coliseum backend is a visible stub this pass. */
export const ARENA_SESSIONS_NOT_IMPLEMENTED =
  "Coliseum team sessions are not live yet — this is a preview.";
