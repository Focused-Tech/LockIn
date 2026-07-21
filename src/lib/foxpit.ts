/**
 * Fox Pit practice-mode journey — shared data model.
 *
 * The painted assets live in /public/foxpit/. Each boss owns its OWN art
 * (owl/wolf/raven/fox) — no substitution. Map floor positions are vertical
 * centers as a % of map/tower-map-stairs.png (1536x3072, stairs-only tower,
 * top = Suite/penthouse, bottom = Dojo/basement). Measured off the plate's
 * floor bands. Client-only UI data — no server dependency.
 */

export type FoxPitRoomKey = "dojo" | "coliseum" | "hightable" | "suite";
export type BossArt = "owl" | "wolf" | "raven" | "fox";

export interface FoxPitRoom {
  key: FoxPitRoomKey;
  /** climb order, 0 = first (Dojo). */
  order: number;
  name: string;
  floorLabel: string;
  boss: string;
  bossArt: BossArt;
  crest: string;
  accent: string;
  /** the boss-key this floor's door needs to unlock (from the boss one below); null = always open. */
  needsKey: BossArt | null;
  /** vertical center on map/tower-map-stairs.png, as a fraction of image height. */
  mapY: number;
  roomImg: string;
  avatarImg: string;
  faceoffImg: string;
  tables: number;
}

export const FOXPIT_ROOMS: FoxPitRoom[] = [
  {
    key: "dojo", order: 0, name: "Dojo", floorLabel: "Basement · Training",
    boss: "Owl", bossArt: "owl", crest: "O", accent: "#c9873f", needsKey: null, mapY: 0.91,
    roomImg: "/foxpit/room-dojo.png", avatarImg: "/foxpit/avatar-owl.png", faceoffImg: "/foxpit/faceoff-owl.png",
    tables: 1,
  },
  {
    key: "coliseum", order: 1, name: "Coliseum", floorLabel: "Level 2 · Indoor Stadium",
    boss: "Wolf", bossArt: "wolf", crest: "W", accent: "#c22b22", needsKey: "owl", mapY: 0.50,
    roomImg: "/foxpit/room-coliseum.png", avatarImg: "/foxpit/avatar-wolf.png", faceoffImg: "/foxpit/faceoff-wolf.png",
    tables: 5,
  },
  {
    key: "hightable", order: 2, name: "High Table", floorLabel: "Level 3 · VIP Lounge",
    boss: "Raven", bossArt: "raven", crest: "R", accent: "#8a4dff", needsKey: "wolf", mapY: 0.235,
    roomImg: "/foxpit/room-hightable.png", avatarImg: "/foxpit/avatar-raven.png", faceoffImg: "/foxpit/faceoff-raven.png",
    tables: 3,
  },
  {
    key: "suite", order: 3, name: "Boss Fox's Suite", floorLabel: "Penthouse · Private 1v1",
    boss: "Boss Fox", bossArt: "fox", crest: "※", accent: "#c8a24b", needsKey: "raven", mapY: 0.08,
    roomImg: "/foxpit/room-suite.png", avatarImg: "/foxpit/avatar-fox.png", faceoffImg: "/foxpit/faceoff-fox.png",
    tables: 1,
  },
];

/** The Lobby floor sits between Coliseum and Dojo on the map (street level, a hub, not a room). Measured off the stairs-only tower plate (bar room with the red neon fox). */
export const LOBBY_MAP_Y = 0.75;
/** The elevator is locked in practice and unlocks once you clear the High Table. */
export const ELEVATOR_UNLOCK_AT: FoxPitRoomKey = "hightable";

export function roomByKey(k: FoxPitRoomKey): FoxPitRoom {
  return FOXPIT_ROOMS.find((r) => r.key === k)!;
}

/** display copy for a boss-key badge (e.g. locked door "needs OWL key"). */
export function keyLabel(a: BossArt): string {
  return a.toUpperCase();
}

/**
 * Tiered PRIZE-KEY art — the key you win by clearing each boss's room.
 * Dojo/Owl→bronze, Coliseum/Wolf→silver, High Table/Raven→gold, Suite/Fox→platinum.
 * Used for the floating room prize key AND the elevator's "keys won" panel.
 */
export const KEY_ASSET: Record<BossArt, { src: string; tier: string }> = {
  owl: { src: "/foxpit/key-owl-bronze.png", tier: "Bronze" },
  wolf: { src: "/foxpit/key-wolf-silver.png", tier: "Silver" },
  raven: { src: "/foxpit/key-raven-gold.png", tier: "Gold" },
  fox: { src: "/foxpit/key-bossfox-platinum.png", tier: "Platinum" },
};

/** The neon fox emblem painted on the room door. */
export const DOOR_EMBLEM = "/foxpit/emblem-fox-neon.png";
/** The membership card art (free-entry keycard + member profile card). */
export const MEMBERSHIP_CARD = "/foxpit/membership-card.png";

// ---- client-side progression (practice demo persists in localStorage) ----
const CLEARED_KEY = "foxpit.cleared.v1";

/**
 * ARCHITECT OVERRIDE (temporary): the architect's account is treated as having
 * cleared every room EXCEPT Boss Fox's Suite, so the full journey plays out —
 * keys won (owl/wolf/raven), the elevator unlocked, only the final boss left.
 * Remove / gate to real progression before launch.
 */
const ARCHITECT_CLEARED: FoxPitRoomKey[] = ["dojo", "coliseum", "hightable"];

export function getCleared(): Set<FoxPitRoomKey> {
  const s = new Set<FoxPitRoomKey>(ARCHITECT_CLEARED);
  if (typeof window === "undefined") return s;
  try {
    (JSON.parse(localStorage.getItem(CLEARED_KEY) || "[]") as FoxPitRoomKey[]).forEach((k) => s.add(k));
  } catch {
    /* ignore malformed storage */
  }
  return s;
}
export function markCleared(k: FoxPitRoomKey) {
  if (typeof window === "undefined") return;
  const s = getCleared();
  s.add(k);
  localStorage.setItem(CLEARED_KEY, JSON.stringify([...s]));
}

/**
 * ARCHITECT OVERRIDE (temporary): every room door is unlocked so the architect
 * can walk into and review each room. Gate this back to real progression before
 * launch (e.g. per-account / role check).
 */
export const FOXPIT_UNLOCK_ALL = true;

/** A floor is unlocked if it's the Dojo, or the floor below it has been cleared. */
export function isUnlocked(room: FoxPitRoom, cleared: Set<FoxPitRoomKey>): boolean {
  if (FOXPIT_UNLOCK_ALL) return true;
  if (room.needsKey === null) return true;
  const below = FOXPIT_ROOMS.find((r) => r.order === room.order - 1);
  return below ? cleared.has(below.key) : false;
}
