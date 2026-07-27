/**
 * FOX PIT — UNDERLING PACKS (Coliseum wolves, High Table ravens).
 *
 * Source of truth: docs/MASTER_STATE_LEDGER_foxpit.md §1 (names + genders) and Frank's
 * approved win-rate ladders (ascending, ~2% steps, ALWAYS strictly below the room boss:
 * Alpha Wolf 45, Boss Raven 65). You always face the LOWEST win-rate underling first and
 * scale up; the pack ROTATES through the room's tables (ledger §2 line 52).
 *
 * Owl (Dojo) and Boss Fox (Suite) are SOLO bosses — no underlings; they own their own table.
 *
 * ART: only three seated cutouts exist per clan today
 * (wolf: ghost/luna/vixen, raven: nyx/omen/pica). Underlings in the ledger roster that are
 * not yet rendered (Runt/Scout/Fang, Quill/Grim/Hex) borrow a clanmate's face and are flagged
 * `placeholderArt` — swap the `art` path once their cutout lands. Nothing else changes.
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";

export interface Underling {
  name: string;
  /** AI per-question correctness. Strictly below the room boss. Ascending across the pack. */
  winPct: number;
  gender: "M" | "F";
  /** Seated cutout in /public/foxpit/cutouts. */
  art: string;
  /** true = borrowing a clanmate's face until this underling's own cutout is rendered. */
  placeholderArt?: boolean;
}

const WOLF = (f: string) => `/foxpit/cutouts/underling_${f}_wolf.png`;
const RAVEN = (f: string) => `/foxpit/cutouts/underling_${f}_raven.png`;

/**
 * Packs ordered ASCENDING by win rate — index 0 = the first (weakest) table, last = the
 * strongest underling (still below the boss). One entry per underling table in the room.
 */
export const UNDERLINGS: Partial<Record<FoxPitRoomKey, Underling[]>> = {
  // Coliseum — Alpha Wolf 45%. Five underling tables, wolves 30 → 44.
  coliseum: [
    { name: "Luna", winPct: 30, gender: "F", art: WOLF("luna") },
    { name: "Vixen", winPct: 35, gender: "F", art: WOLF("vixen") },
    { name: "Ghost", winPct: 40, gender: "M", art: WOLF("ghost") },
    { name: "Fang", winPct: 42, gender: "M", art: WOLF("ghost"), placeholderArt: true },
    { name: "Scout", winPct: 44, gender: "M", art: WOLF("vixen"), placeholderArt: true },
  ],
  // High Table — Boss Raven 65%. Four underling tables, ravens 50 → 64.
  hightable: [
    { name: "Omen", winPct: 50, gender: "M", art: RAVEN("omen") },
    { name: "Pica", winPct: 55, gender: "F", art: RAVEN("pica") },
    { name: "Nyx", winPct: 60, gender: "F", art: RAVEN("nyx") },
    { name: "Hex", winPct: 64, gender: "M", art: RAVEN("omen"), placeholderArt: true },
  ],
};

/** The pack for a room (empty for solo-boss rooms). */
export function packFor(room: FoxPitRoomKey): Underling[] {
  return UNDERLINGS[room] ?? [];
}

/** How many underling tables a room has (0 for Owl/Fox — boss-only). */
export function underlingTableCount(room: FoxPitRoomKey): number {
  return packFor(room).length;
}

/**
 * The underling seated at table `idx` (0-based). The pack rotates if a room ever has more
 * tables than named underlings (it doesn't today — pack length == table count). Returns null
 * for solo-boss rooms.
 */
export function underlingAt(room: FoxPitRoomKey, idx: number): Underling | null {
  const pack = packFor(room);
  if (pack.length === 0) return null;
  return pack[idx % pack.length] ?? null;
}
