/**
 * FOX PIT — UNDERLING PACKS (Coliseum wolves, High Table ravens).
 *
 * Source of truth: docs/MASTER_STATE_LEDGER_foxpit.md §3 "re-spaced 6-ladder" + Frank's
 * corner→name ruling. Win rates are the ledger's EXACT values — never rounded/rescaled/re-spaced.
 * You face the LOWEST win-rate underling first and scale up; every underling stays strictly below
 * the room boss (Alpha Wolf 45, Boss Raven 65).
 *
 *   WOLF PACK (6):   Runt 25 · Luna 28 · Scout 31 · Fang 34 · Vixen 37 · Ghost 40
 *   RAVEN FLOCK (6): Omen 44 · Hex 47 · Pica 50 · Quill 53 · Nyx 56 · Grim 60
 *
 * SEATING (Frank's ruling): second-tier opponents are NOT table underlings — they hold their own
 * encounter (built in Stage 2). The tables seat the lowest N ascending; the surplus is second-tier:
 *   Coliseum  — 5 tables: Runt·Luna·Scout·Fang·Vixen.  Ghost 40 = second tier.
 *   High Table — 4 tables: Omen·Hex·Pica·Quill.  Grim 60 = second tier (Nyx 56 ascends once Grim
 *                falls). Alpha Wolf / Boss Raven = floor boss on the throne (their own table).
 *
 * ART (Frank's corner→name ruling, FINAL — no clanmate stands in for anyone):
 *   Standalone final cuts: wolf ghost/luna/vixen, raven nyx/omen/pica.
 *     - Ghost NOT in the wolf grid (rendered standalone) — underling_ghost_wolf.png only.
 *     - Pica NOT in the raven grid (the magpie) — underling_pica_raven.png only.
 *     - Nyx = raven grid BR (was mislabeled "Vixen"); art unchanged — underling_nyx_raven.png.
 *   Imported from the 611x611 review sheet + renamed to the character:
 *     wolf  TL→Runt  TR→Scout  BL→Fang        raven TL→Grim  TR→Quill  BL→Hex
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";

export interface Underling {
  name: string;
  /** AI per-question correctness — ledger §3 exact value. Ascending across the pack. */
  winPct: number;
  gender: "M" | "F";
  /** Seated cutout under /public/foxpit/cutouts. */
  art: string;
  /** true = holds their own second-tier encounter, not a table seat (Stage 2). */
  secondTier?: boolean;
  /** carried quality flag from the ledger — do NOT silently fix. */
  artNote?: string;
}

const WOLF = (f: string) => `/foxpit/cutouts/underling_${f}_wolf.png`;
const RAVEN = (f: string) => `/foxpit/cutouts/underling_${f}_raven.png`;

/**
 * Packs ordered ASCENDING by win rate — index 0 = weakest (faced first). All 6 clan members are
 * present; none dropped. The lowest N (= underlingTableCount) take the tables; the rest are marked
 * secondTier.
 */
export const UNDERLINGS: Partial<Record<FoxPitRoomKey, Underling[]>> = {
  // Coliseum — Alpha Wolf 45%. Wolves 25 → 40.
  coliseum: [
    { name: "Runt", winPct: 25, gender: "M", art: WOLF("runt"), artNote: "too dark, needs relight; hand-through-table error" },
    { name: "Luna", winPct: 28, gender: "F", art: WOLF("luna") },
    { name: "Scout", winPct: 31, gender: "M", art: WOLF("scout"), artNote: "too dark, needs relight" },
    { name: "Fang", winPct: 34, gender: "M", art: WOLF("fang"), artNote: "v1 too dark, needs overhead-lamp relight" },
    { name: "Vixen", winPct: 37, gender: "F", art: WOLF("vixen") },
    { name: "Ghost", winPct: 40, gender: "M", art: WOLF("ghost"), secondTier: true, artNote: "FINAL — exact existing cut, never restyle/regenerate" },
  ],
  // High Table — Boss Raven 65%. Ravens 44 → 60.
  hightable: [
    { name: "Omen", winPct: 44, gender: "M", art: RAVEN("omen") },
    { name: "Hex", winPct: 47, gender: "M", art: RAVEN("hex") },
    { name: "Pica", winPct: 50, gender: "F", art: RAVEN("pica") },
    { name: "Quill", winPct: 53, gender: "M", art: RAVEN("quill") },
    { name: "Nyx", winPct: 56, gender: "F", art: RAVEN("nyx"), secondTier: true },
    { name: "Grim", winPct: 60, gender: "M", art: RAVEN("grim"), secondTier: true },
  ],
};

/**
 * Underling TABLE counts (Stage 2 — Frank's ruling): the room is (underling tables) → (a 2nd-tier
 * encounter) → (the boss table). Coliseum = 4 tables + Ghost + Boss Wolf (6 tiles). High Table = 3
 * tables + Grim + Boss Raven (5 tiles). The lowest-N by win rate take the tables; the designated
 * 2nd-tier holds its own encounter (SECOND_TIER below). Surplus roster (Coliseum Vixen; High Table
 * Quill, Nyx) is benched on the first playthrough — Nyx is the REPLAY 2nd-tier (Stage 2 replay
 * mechanic, flagged, not built here).
 */
const UNDERLING_TABLES: Partial<Record<FoxPitRoomKey, number>> = {
  coliseum: 4,
  hightable: 3,
};

/** The 2nd-tier boss for each room's FIRST playthrough — its own encounter after the tables, before
 *  the floor boss. (Replay swaps High Table's to Nyx; that mechanic is flagged, not built yet.) */
const SECOND_TIER_NAME: Partial<Record<FoxPitRoomKey, string>> = {
  coliseum: "Ghost",
  hightable: "Grim",
};

/** The 2nd-tier opponent for a room (Ghost / Grim), or null for rooms without one (Dojo/Suite). */
export function secondTierOf(room: FoxPitRoomKey): Underling | null {
  const name = SECOND_TIER_NAME[room];
  if (!name) return null;
  return packFor(room).find((u) => u.name === name) ?? null;
}

/** Does this room have a 2nd-tier encounter between its tables and its boss? */
export function hasSecondTier(room: FoxPitRoomKey): boolean {
  return !!SECOND_TIER_NAME[room];
}

/** The full pack for a room (all 6 members; empty for solo-boss rooms Owl/Fox). */
export function packFor(room: FoxPitRoomKey): Underling[] {
  return UNDERLINGS[room] ?? [];
}

/** Number of underling TABLES in a room (0 for Owl/Fox — boss-only). */
export function underlingTableCount(room: FoxPitRoomKey): number {
  return UNDERLING_TABLES[room] ?? 0;
}

/**
 * The underling seated at table `idx` (0-based, lowest-first). Only the first
 * `underlingTableCount(room)` members take tables; the rest are second-tier. Returns null for
 * solo-boss rooms or an out-of-range index.
 */
export function underlingAt(room: FoxPitRoomKey, idx: number): Underling | null {
  const pack = packFor(room);
  if (pack.length === 0 || idx >= underlingTableCount(room)) return null;
  return pack[idx] ?? null;
}
