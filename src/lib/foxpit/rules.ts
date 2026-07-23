/**
 * FOX PIT — BOSS JOURNEY ruleset (self-contained, COIN economy).
 *
 * This is NOT the real-money beginner/advanced pools and NOT the Lone Wolf /
 * practice-arena engine — both of those are left untouched. Every value below is a
 * NAMED constant straight from the build doc (keep-N deal math, per-room rounds,
 * boss win%, category hedge, stakes, timers, economy).
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";

/** Slates dealt each round; you ALWAYS play all of them. */
export const SLATES_PER_ROUND = 5;

/** The mulligan: the discarded (non-kept) slates may be redealt ONCE per round. */
export const REDEALS_PER_ROUND = 1;

/** The Fox Pit category pool. Sports = World Cup real-data. */
export const FOXPIT_CATEGORIES = [
  "music",
  "entertainment",
  "sports",
  "politics",
  "crypto",
  "weather",
] as const;
export type FoxPitCategory = (typeof FOXPIT_CATEGORIES)[number];

/** Prediction / real-data slates enter at Raven; the full mix arrives at Fox. */
export const REAL_DATA_ENTERS_AT: FoxPitRoomKey = "hightable";

/**
 * Fox Pit category → the app-wide slate COLOR CANON key (`categoryTint` in
 * src/lib/practice/tints.ts is the single source of truth for slate outlines).
 * Sports here is the World Cup, so it maps to the Soccer hue.
 */
export const CATEGORY_TINT_KEY: Record<FoxPitCategory, string> = {
  music: "Music",
  entertainment: "Entertainment",
  sports: "Soccer",
  politics: "Politics",
  crypto: "Crypto",
  weather: "Weather",
};

export interface RoomRules {
  boss: string;
  floor: number;
  /** Tables in the room (Coliseum = 5, etc.). */
  tables: number;
  rounds: number;
  /** Keep-N (mulligan FLOOR) per round — you must KEEP at least this many of the 5. */
  keepN: number[];
  /** The AI boss's per-question correctness — gates advancement + bonuses,
   *  it does NOT block coin-banking. */
  bossWinPct: number;
  /** Coin stake tiers offered per slate. */
  stakes: number[];
  /** Seconds per question in this room. */
  secondsPerQuestion: number;
  note?: string;
}

/** Floor 2 (Lobby) has no play, so it is intentionally absent from the ruleset. */
export const ROOM_RULES: Record<FoxPitRoomKey, RoomRules> = {
  dojo: { boss: "Sensei Owl", floor: 1, tables: 1, rounds: 2, keepN: [1, 2], bossWinPct: 25, stakes: [5, 10, 15], secondsPerQuestion: 15 },
  coliseum: { boss: "Alpha Wolf", floor: 3, tables: 5, rounds: 3, keepN: [1, 2, 3], bossWinPct: 45, stakes: [5, 10, 15], secondsPerQuestion: 20 },
  hightable: { boss: "Boss Raven", floor: 4, tables: 4, rounds: 4, keepN: [1, 2, 3, 3], bossWinPct: 65, stakes: [5, 10, 15, 25], secondsPerQuestion: 45, note: "4th table = double-or-nothing" },
  suite: { boss: "Boss Fox", floor: 5, tables: 1, rounds: 5, keepN: [3, 3, 3, 4, 4], bossWinPct: 85, stakes: [15, 25, 50], secondsPerQuestion: 12, note: "winner-take-all" },
};

/** Category-hedge decay by difficulty: how many categories the player gets to pick,
 *  and how many are dealt. Owl = widest hedge; Fox = all dealt (no hedge). */
export const CATEGORY_HEDGE: Record<FoxPitRoomKey, { pick: number; dealt: number | "all" }> = {
  dojo: { pick: 5, dealt: 5 },
  coliseum: { pick: 3, dealt: 2 },
  hightable: { pick: 2, dealt: 3 },
  suite: { pick: FOXPIT_CATEGORIES.length, dealt: "all" },
};

/**
 * ELEVATOR STOPS — where the car's BOTTOM EDGE parks at each landing, as a % of
 * the BUILD MAP height (public/foxpit/map/tower_map_clean.png, 1620x4500).
 *
 * These are Frank's measured stop lines: the TOP EDGE of each pale marker band he
 * drew on tower_map_elevator_markup.png (1620x4500, reference only — never shipped).
 * TOP edge, not bottom, not middle: the car's bottom edge rests on the band's top
 * edge so the avatar steps off level onto the landing.
 *
 * SEVEN stops top→bottom — the double-height Coliseum has two (upper + lower). Do
 * NOT re-derive from artwork or layer a second table on top of this: this is the
 * only stop table in the codebase (every plaque/seam/ledge set was deleted).
 */
export type ElevatorStopId =
  | "winners"
  | "suite"
  | "hightable"
  | "coliseumUpper"
  | "coliseumLower"
  | "lobby"
  | "dojo";

export interface ElevatorStop {
  id: ElevatorStopId;
  /** The room this stop serves. "lobby" = hub (no play); "winners" = rooftop PvP. */
  room: FoxPitRoomKey | "lobby" | "winners";
  label: string;
  /** Car BOTTOM-edge park position = top edge of Frank's marker band, % of map height. */
  pct: number;
}

export const ELEVATOR_STOPS: ElevatorStop[] = [
  { id: "winners", room: "winners", label: "Winner's Lounge", pct: 26.844 }, // STOP_1
  { id: "suite", room: "suite", label: "Boss Fox's Suite", pct: 37.111 }, // STOP_2
  { id: "hightable", room: "hightable", label: "High Table", pct: 49.711 }, // STOP_3
  { id: "coliseumUpper", room: "coliseum", label: "Coliseum — upper", pct: 64.044 }, // STOP_4
  { id: "coliseumLower", room: "coliseum", label: "Coliseum — lower", pct: 75.178 }, // STOP_5
  { id: "lobby", room: "lobby", label: "Lobby", pct: 87.333 }, // STOP_6
  { id: "dojo", room: "dojo", label: "Dojo", pct: 97.222 }, // STOP_7
];

/** STOP_1 — the top of the shaft (Winner's Lounge). The car runs the FULL height to here. */
export const ELEVATOR_TOP_STOP_PCT = ELEVATOR_STOPS[0]!.pct;
/** STOP_7 — the bottom of the shaft (Dojo). The car's idle rest position. */
export const ELEVATOR_BOTTOM_STOP_PCT = ELEVATOR_STOPS[ELEVATOR_STOPS.length - 1]!.pct;

/** Stop-by-id lookup, for keyframe generation + the ride target. */
export const ELEVATOR_STOP_BY_ID: Record<ElevatorStopId, number> = Object.fromEntries(
  ELEVATOR_STOPS.map((s) => [s.id, s.pct]),
) as Record<ElevatorStopId, number>;

/** Timers (seconds). */
export const TIMERS = {
  questionDefault: 15,   // Owl
  questionRavenMax: 45,  // grows toward this as questions grow
  questionBossFox: 12,
  discardDecision: 20,   // keep/redeal window; expired stake = dead chip (lost)
} as const;

/** Economy — COINS only, zero rake across the whole journey. */
export const ECONOMY = {
  owlFree: true,
  owlRefillTo: 250, // Owl tier only, on bust
  bossFoxEntry: 5000,
  bossFoxPot: 10000, // winner-take-all
  rake: 0,
} as const;

/** Shown in-app + in build output (bump per build). */
export const FOXPIT_BUILD_VERSION = "fp-climb-1";

/** Keep-N for a given room + round index (0-based), clamped to the round table. */
export function keepNFor(room: FoxPitRoomKey, roundIndex: number): number {
  const arr = ROOM_RULES[room].keepN;
  return arr[Math.min(roundIndex, arr.length - 1)] ?? 1;
}
