/**
 * Prediction categories — fixed reference data (no longer a DB table).
 * Order is the display/sort order.
 */
export interface Category {
  name: string;
  icon: string;
}

export const CATEGORIES: readonly Category[] = [
  { name: "NASCAR", icon: "🏎️" },
  { name: "Esports", icon: "🎮" },
  { name: "UFC", icon: "🥋" },
  { name: "Boxing", icon: "🥊" },
  { name: "Tennis", icon: "🎾" },
  { name: "Golf", icon: "⛳" },
  { name: "Soccer", icon: "⚽" },
  { name: "NFL", icon: "🏈" },
  { name: "NBA", icon: "🏀" },
  { name: "MLB", icon: "⚾" },
  { name: "NHL", icon: "🏒" },
  { name: "Entertainment", icon: "🎬" },
  { name: "TV Shows", icon: "📺" },
  { name: "Music", icon: "🎵" },
  { name: "Politics", icon: "🗳️" },
  { name: "Geopolitics", icon: "🌍" },
  { name: "Crypto", icon: "🪙" },
  { name: "Economics", icon: "📈" },
  { name: "Weather", icon: "🌪️" },
  { name: "Viral", icon: "🔥" },
];

/**
 * STORE COMPLIANCE STRIP — the sports/non-sports line. Sports has a licence category and a Google
 * acceptance path (daily-fantasy-sports framework); nothing else does. Cash entries in any category
 * NOT in this set are blocked on the mobile app (see src/server/data/slates.ts,
 * src/app/app/slate/[id]/actions.ts). Coin play is unaffected everywhere.
 */
export const SPORTS_CATEGORIES: ReadonlySet<string> = new Set([
  "NASCAR",
  "Esports",
  "UFC",
  "Boxing",
  "Tennis",
  "Golf",
  "Soccer",
  "NFL",
  "NBA",
  "MLB",
  "NHL",
]);

export function isSportsCategory(category: string): boolean {
  return SPORTS_CATEGORIES.has(category);
}
