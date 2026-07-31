/**
 * BOSS SNACK ATTACK — THE ACCESS GATE (one gate function, one source of truth).
 *
 * The Snack Bar is NOT a free reward — it is a COIN-REPLENISHMENT FAUCET. Coins gate entry to the
 * tower's paid tables; a player who busts their stack is locked out. The Snack Bar is how they get
 * back in, so it must NOT be freely playable while they can still afford a seat they can reach.
 *
 * The per-floor entry fees mirror ENTRY_FEE in the byte-frozen build (boss_snack_attack_v4.html):
 *   ENTRY_FEE = [0, 1000, 1000, 2500, 2500, 5000]  → Dojo free · Coliseum 1k · High Table 2.5k ·
 *   Boss Fox 5k. The four tower rooms map onto those distinct tiers. The build is NOT changed; these
 *   are the same numbers the access layer needs on the React side.
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";

/** A seat's cost per tower room — the ENTRY_FEE tiers, keyed to the rooms that charge them. */
export const ROOM_ENTRY_FEE: Record<FoxPitRoomKey, number> = {
  dojo: 0, // free practice
  coliseum: 1000, // ENTRY_FEE 1k
  hightable: 2500, // ENTRY_FEE 2.5k
  suite: 5000, // Boss Fox — ENTRY_FEE 5k
};

/** The Dojo wallet ceiling — CAP_AT[0] in the build. Below this a player can farm back up to 500. */
export const DOJO_CEILING = 500;

/** Shown when a player taps the phone while the gate is closed (they still have coins to play with). */
export const SNACK_CLOSED_REASON = "Kitchen's closed — you've still got coins to play with";

export interface SnackGateState {
  /** The player's current coin balance. */
  coins: number;
  /** The tower rooms the player has UNLOCKED (entitled to a seat in). */
  unlockedRooms: FoxPitRoomKey[];
  /** Boss Fox beaten — the Winner's Lounge is open, and the bar is freely playable from there. */
  bossFoxBeaten: boolean;
}

/**
 * The gate. Open (the Snack Bar unlocks) when ANY holds:
 *   1.4 Boss Fox beaten          → freely playable (no coin condition)
 *   1.1 coins === 0              → fully depleted
 *   1.2 coins < 500              → below the Dojo ceiling; can top back up
 *   1.3 coins < a fee for a floor they've UNLOCKED (per-floor: short for Boss Fox opens it even if
 *       they can still afford a Coliseum seat)
 * Otherwise LOCKED — a player who can still buy a seat they can reach does not get to farm.
 */
export function snackBarUnlocked(s: SnackGateState): boolean {
  if (s.bossFoxBeaten) return true; // 1.4
  if (s.coins <= 0) return true; // 1.1
  if (s.coins < DOJO_CEILING) return true; // 1.2
  for (const k of s.unlockedRooms) {
    if (s.coins < ROOM_ENTRY_FEE[k]) return true; // 1.3 — per-floor
  }
  return false;
}
