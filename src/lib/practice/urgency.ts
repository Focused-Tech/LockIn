/**
 * PRACTICE URGENCY — countdown + "spot race" math.
 *
 * A practice slate has a visible countdown to lock. As it winds down, LABELED
 * mock players (training bots — never presented as real humans) claim the top
 * spots one at a time (best spot first), capped at `maxSpots` (3). The longer a
 * player hesitates, the fewer premium spots remain; the spot they land in scales
 * their payout (SCORE only) via `spotBonus`.
 *
 * Pure + deterministic (a function of elapsed time) so the SERVER computes the
 * awarded spot authoritatively at submit and the CLIENT renders the exact same
 * fill timeline live — no trust in the client, no per-player persisted state.
 *
 * Client-safe (no server-only deps) so the countdown UI can import it directly.
 */
import { PRACTICE_CONFIG } from "./config";

const U = PRACTICE_CONFIG.urgency;

export interface MockPlayer {
  id: string;
  name: string;
  avatar: string;
}

/** Labeled training bots that fill spots. Clearly NOT real humans. */
export const MOCK_PLAYERS: readonly MockPlayer[] = [
  { id: "bot_drill", name: "Drill Bot", avatar: "🤖" },
  { id: "bot_scrim", name: "Scrim Bot", avatar: "🦾" },
  { id: "bot_sparring", name: "Sparring Bot", avatar: "🥊" },
  { id: "bot_pace", name: "Pace Bot", avatar: "⚙️" },
] as const;

/** Fraction (0–1) of the countdown that has elapsed at `now`. */
export function elapsedFrac(startAt: number, lockAt: number, now: number): number {
  const total = lockAt - startAt;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - startAt) / total));
}

/** How many of the top spots have been claimed by mocks at this elapsed fraction. */
export function spotsFilledAt(frac: number): number {
  const n = U.spotFillFracs.filter((f) => frac >= f).length;
  return Math.min(U.maxSpots, n);
}

/**
 * The best spot still available to the player given `filled` spots taken — i.e.
 * the spot they'd claim by locking in right now. Null once all top spots are gone.
 */
export function bestAvailableSpot(filled: number): number | null {
  return filled < U.maxSpots ? filled + 1 : null;
}

/** Winnings multiplier for a claimed spot (1.0 when no premium spot was claimed). */
export function spotBonusMultiplier(spot: number | null): number {
  if (spot == null || spot < 1) return 1;
  return U.spotBonus[spot - 1] ?? 1;
}

export interface SpotFill {
  /** 1-based spot index (1 = best). */
  spot: number;
  /** Elapsed fraction at which a mock claims this spot. */
  atFrac: number;
  /** The labeled mock that claims it. */
  mock: MockPlayer;
}

/**
 * The full fill timeline for a contest's spot race: which mock claims each spot
 * and when (top spot first). `seed` (the contest id) keeps the mock assignment
 * stable across re-renders without persisting anything.
 */
export function fillSchedule(seed: string): SpotFill[] {
  const base = hashSeed(seed);
  const count = Math.min(U.mockPlayerCount, MOCK_PLAYERS.length);
  return U.spotFillFracs.slice(0, U.maxSpots).map((atFrac, i) => ({
    spot: i + 1,
    atFrac,
    mock: MOCK_PLAYERS[(base + i) % count]!,
  }));
}

/** Resolve the player's awarded spot + payout multiplier at submit time. */
export function resolveSpot(
  startAt: number,
  lockAt: number,
  now: number,
): { spot: number | null; filled: number; bonus: number } {
  const filled = spotsFilledAt(elapsedFrac(startAt, lockAt, now));
  const spot = bestAvailableSpot(filled);
  return { spot, filled, bonus: spotBonusMultiplier(spot) };
}

/** Small stable hash for deterministic mock selection (no randomness). */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}
