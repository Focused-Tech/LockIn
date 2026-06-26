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
