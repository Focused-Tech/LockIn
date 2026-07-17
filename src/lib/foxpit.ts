/**
 * Fox Pit practice-mode journey — shared data model.
 *
 * The painted assets live in /public/foxpit/. Each boss owns its OWN art
 * (owl/wolf/raven/fox) — no substitution. Map floor positions are vertical
 * centers as a % of map-tower.png (887x2790, top = Suite/penthouse, bottom =
 * Dojo/basement). Client-only UI data — no server dependency.
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
  /** vertical center on map-tower.png, as a fraction of image height. */
  mapY: number;
  roomImg: string;
  avatarImg: string;
  faceoffImg: string;
  tables: number;
}

export const FOXPIT_ROOMS: FoxPitRoom[] = [
  {
    key: "dojo", order: 0, name: "The Dojo", floorLabel: "Basement · Training",
    boss: "Owl", bossArt: "owl", crest: "O", accent: "#c9873f", needsKey: null, mapY: 0.895,
    roomImg: "/foxpit/room-dojo.png", avatarImg: "/foxpit/avatar-owl.png", faceoffImg: "/foxpit/faceoff-owl.png",
    tables: 1,
  },
  {
    key: "coliseum", order: 1, name: "The Coliseum", floorLabel: "Level 2 · Indoor Stadium",
    boss: "Wolf", bossArt: "wolf", crest: "W", accent: "#c22b22", needsKey: "owl", mapY: 0.485,
    roomImg: "/foxpit/room-coliseum.png", avatarImg: "/foxpit/avatar-wolf.png", faceoffImg: "/foxpit/faceoff-wolf.png",
    tables: 3,
  },
  {
    key: "hightable", order: 2, name: "The High Table", floorLabel: "Level 3 · VIP Lounge",
    boss: "Raven", bossArt: "raven", crest: "R", accent: "#8a4dff", needsKey: "wolf", mapY: 0.27,
    roomImg: "/foxpit/room-hightable.png", avatarImg: "/foxpit/avatar-raven.png", faceoffImg: "/foxpit/faceoff-raven.png",
    tables: 3,
  },
  {
    key: "suite", order: 3, name: "Boss Fox's Suite", floorLabel: "Penthouse · Private 1v1",
    boss: "Boss Fox", bossArt: "fox", crest: "※", accent: "#c8a24b", needsKey: "raven", mapY: 0.09,
    roomImg: "/foxpit/room-suite.png", avatarImg: "/foxpit/avatar-fox.png", faceoffImg: "/foxpit/faceoff-fox.png",
    tables: 1,
  },
];

/** The Lobby floor sits between Coliseum and Dojo on the map (street level, a hub, not a room). */
export const LOBBY_MAP_Y = 0.695;
/** The elevator is locked in practice and unlocks once you clear the High Table. */
export const ELEVATOR_UNLOCK_AT: FoxPitRoomKey = "hightable";

export function roomByKey(k: FoxPitRoomKey): FoxPitRoom {
  return FOXPIT_ROOMS.find((r) => r.key === k)!;
}

/** display copy for a boss-key badge (e.g. locked door "needs OWL key"). */
export function keyLabel(a: BossArt): string {
  return a.toUpperCase();
}

// ---- client-side progression (practice demo persists in localStorage) ----
const CLEARED_KEY = "foxpit.cleared.v1";

export function getCleared(): Set<FoxPitRoomKey> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(CLEARED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
export function markCleared(k: FoxPitRoomKey) {
  if (typeof window === "undefined") return;
  const s = getCleared();
  s.add(k);
  localStorage.setItem(CLEARED_KEY, JSON.stringify([...s]));
}

/** A floor is unlocked if it's the Dojo, or the floor below it has been cleared. */
export function isUnlocked(room: FoxPitRoom, cleared: Set<FoxPitRoomKey>): boolean {
  if (room.needsKey === null) return true;
  const below = FOXPIT_ROOMS.find((r) => r.order === room.order - 1);
  return below ? cleared.has(below.key) : false;
}
