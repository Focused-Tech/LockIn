/**
 * SUBCATEGORY SEED INDEX (B) — the STARTING index a creator searches. This module is DATA (no
 * component imports a show name — they import from here / Firestore). The seed is written to the
 * `subcategories` Firestore collection by scripts/seed-subcategories.mjs; after that, new shows are
 * added as Firestore docs and appear in search with NO deploy (the search action merges Firestore
 * over this seed).
 *
 * Reality-TV seeds are drawn from the most-watched titles carried by the reality-listings network
 * "All Reality" (recorded in each row's `source` so the list can be audited and extended). Show NAMES
 * are public data; CAST is NOT seeded here — cast is supplied per show by the creator (no cast API
 * exists yet; see src/lib/contest/cast.ts).
 */
import type { Subcategory, SubStat } from "./types";

// ── Stat vocabularies (fill {stat}) ───────────────────────────────────────────────────────────────
const NBA_STATS: SubStat[] = [
  { stat: "points", boxLabel: "PTS", milestone: 30, race: 20 },
  { stat: "rebounds", boxLabel: "REB", milestone: 10, race: 8 },
  { stat: "assists", boxLabel: "AST", milestone: 10, race: 6 },
];
const NFL_STATS: SubStat[] = [
  { stat: "receiving yards", boxLabel: "YDS", milestone: 100, race: 75 },
  { stat: "rushing yards", boxLabel: "YDS", milestone: 100, race: 75 },
  { stat: "passing yards", boxLabel: "YDS", milestone: 300, race: 200 },
];
const MLB_STATS: SubStat[] = [
  { stat: "hits", boxLabel: "H", milestone: 2, race: 2 },
  { stat: "home runs", boxLabel: "HR", milestone: 1, race: 1 },
];
const NHL_STATS: SubStat[] = [
  { stat: "points", boxLabel: "P", milestone: 2, race: 1 },
  { stat: "goals", boxLabel: "G", milestone: 1, race: 1 },
];
const SOCCER_STATS: SubStat[] = [{ stat: "goals", boxLabel: "G", milestone: 1, race: 1 }];

// Entertainment stats are NOUNS with NO number on an individual (buckets/races only at settlement).
const DRAMA_STATS: SubStat[] = [
  { stat: "screen time" }, { stat: "mentions" }, { stat: "confessionals" }, { stat: "drama" },
];
const COMP_STATS: SubStat[] = [
  { stat: "camera time" }, { stat: "screen time" }, { stat: "praise" }, { stat: "airtime" },
];

// ── Sports leagues (subject pool = live ESPN roster) ──────────────────────────────────────────────
const LEAGUES: Subcategory[] = [
  league("nba", "NBA", "NBA", NBA_STATS, ["basketball", "hoops"]),
  league("wnba", "WNBA", "NBA", NBA_STATS, ["basketball", "womens basketball"]),
  league("nfl", "NFL", "NFL", NFL_STATS, ["football", "pro football"]),
  league("college-football", "College Football", "NFL", NFL_STATS, ["cfb", "ncaa football"]),
  league("mlb", "MLB", "MLB", MLB_STATS, ["baseball"]),
  league("nhl", "NHL", "NHL", NHL_STATS, ["hockey"]),
  league("eng.1", "Premier League", "Soccer", SOCCER_STATS, ["epl", "english premier league", "football", "soccer"]),
  league("usa.1", "MLS", "Soccer", SOCCER_STATS, ["major league soccer", "football", "soccer"]),
];

function league(espnLeague: string, name: string, category: string, stats: SubStat[], aliases: string[]): Subcategory {
  return { slug: espnLeague, name, category, kind: "sports_league", domain: "sports", aliases, stats, subjectSource: "espn_roster", espnLeague, source: "ESPN" };
}

// ── Reality TV (subject pool = creator-supplied cast) ─────────────────────────────────────────────
// The index spans NETWORKS, not one source: broadcast (ABC/NBC/CBS/Fox) + cable/streaming
// (Bravo/VH1/MTV/TLC/Netflix/Peacock). Each row's `source` records the network so the list can be
// audited and extended. "All Reality" was the reference for cable reality LISTINGS, not a limit — the
// most-watched broadcast titles (Idol, The Voice, DWTS, AGT, Survivor, The Masked Singer, Shark Tank)
// are seeded first-class.
function realityDrama(name: string, net: string, aliases: string[] = []): Subcategory {
  return { slug: slugify(name), name, category: "TV Shows", kind: "reality_drama", domain: "entertainment", aliases, stats: DRAMA_STATS, subjectSource: "creator_cast", source: net };
}
function competition(name: string, net: string, aliases: string[] = []): Subcategory {
  return { slug: slugify(name), name, category: "TV Shows", kind: "competition", domain: "entertainment", aliases, stats: COMP_STATS, subjectSource: "creator_cast", source: net };
}

const REALITY: Subcategory[] = [
  // ── Top-watched broadcast reality (ABC / NBC / CBS / Fox) ──
  competition("American Idol", "ABC", ["idol"]),
  competition("The Voice", "NBC", ["blind auditions", "coaches", "nbc"]),
  competition("Dancing with the Stars", "ABC", ["dwts", "abc"]),
  competition("America's Got Talent", "NBC", ["agt", "nbc"]),
  competition("Survivor", "CBS", ["tribe", "jeff probst", "cbs"]),
  competition("Big Brother", "CBS", ["bb", "houseguests", "cbs"]),
  competition("The Masked Singer", "Fox", ["masked singer", "fox"]),
  competition("Shark Tank", "ABC", ["sharks", "abc", "business", "pitch"]),
  competition("The Amazing Race", "CBS", ["tar", "cbs"]),
  competition("The Traitors", "Peacock", ["traitors", "peacock", "alan cumming"]),
  competition("Hell's Kitchen", "Fox", ["gordon ramsay", "cooking", "fox"]),
  competition("MasterChef", "Fox", ["cooking", "masterchef fox"]),
  competition("Top Chef", "Bravo", ["cooking", "bravo"]),
  competition("The Great British Baking Show", "Netflix", ["bake off", "gbbo", "baking"]),
  competition("Chopped", "Food Network", ["cooking", "food network"]),
  competition("Project Runway", "Bravo", ["fashion", "design", "bravo"]),
  competition("RuPaul's Drag Race", "MTV", ["drag race", "rupaul", "mtv"]),
  competition("The Challenge", "MTV", ["mtv the challenge"]),
  // ── Dating (ABC / Netflix / Peacock / TLC) ──
  realityDrama("The Bachelor", "ABC", ["bachelor nation", "abc"]),
  realityDrama("The Bachelorette", "ABC", ["bachelor nation", "abc"]),
  realityDrama("Love Island USA", "Peacock", ["love island", "islanders", "peacock"]),
  realityDrama("Love Is Blind", "Netflix", ["pods", "netflix"]),
  realityDrama("90 Day Fiancé", "TLC", ["90 day", "ninety day", "tlc"]),
  realityDrama("Married at First Sight", "Lifetime", ["mafs", "lifetime"]),
  // ── Cable / streaming drama ensembles (Bravo / VH1 / MTV / Netflix) ──
  realityDrama("Basketball Wives", "VH1", ["bbw", "vh1"]),
  realityDrama("The Real Housewives of Atlanta", "Bravo", ["rhoa", "housewives", "atlanta", "bravo"]),
  realityDrama("The Real Housewives of Beverly Hills", "Bravo", ["rhobh", "housewives", "beverly hills", "bravo"]),
  realityDrama("The Real Housewives of New Jersey", "Bravo", ["rhonj", "housewives", "new jersey", "bravo"]),
  realityDrama("The Real Housewives of Potomac", "Bravo", ["rhop", "housewives", "potomac", "bravo"]),
  realityDrama("The Real Housewives of Salt Lake City", "Bravo", ["rhoslc", "housewives", "salt lake", "bravo"]),
  realityDrama("Love & Hip Hop", "VH1", ["lhh", "love and hip hop", "vh1"]),
  realityDrama("Vanderpump Rules", "Bravo", ["vpr", "pump rules", "bravo"]),
  realityDrama("The Kardashians", "Hulu", ["kuwtk", "keeping up with the kardashians", "kardashian", "hulu"]),
  realityDrama("Jersey Shore Family Vacation", "MTV", ["jersey shore", "jshore", "mtv"]),
  realityDrama("Selling Sunset", "Netflix", ["oppenheim", "netflix"]),
  realityDrama("Below Deck", "Bravo", ["yacht", "bravo"]),
  realityDrama("Teen Mom", "MTV", ["teen mom og", "teen mom 2", "mtv"]),
];

/** The full seed index (leagues + reality). Order is display/scan order. */
export const SUBCATEGORY_SEED: Subcategory[] = [...LEAGUES, ...REALITY];

/** kebab-case slug from a display name (also used to synthesize unknown shows). */
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "custom";
}

/** the entertainment stat vocabulary used for a synthesized (not-yet-indexed) show. */
export const DEFAULT_ENTERTAINMENT_STATS = DRAMA_STATS;
