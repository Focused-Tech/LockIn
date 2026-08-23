/**
 * JOURNEY LANES — the front-door choices, as DATA.
 *
 * The mobile journey selector and the web one show DIFFERENT sets of the same lanes, so the lanes
 * stop being hardcoded JSX and become a list that each surface filters. One definition, two
 * renderings — a lane cannot exist on one surface and be quietly missing its copy on the other.
 *
 * WEB drops every COIN lane. The website is the paid surface: Beginner and the Fox Pit practice
 * journey are coin play and do not belong on it. Filtering happens on `currency`, not on a
 * hand-maintained list of ids, so a coin lane added later is excluded from web automatically rather
 * than needing someone to remember.
 */

export type LaneCurrency = "cash" | "coins";

export interface JourneyLaneDef {
  id: string;
  title: string;
  body: string;
  currency: LaneCurrency;
  /** Colour key used by the card's 4px left edge. */
  color: "creator" | "orange" | "fox";
  href: string;
  /** True when this is a persisted Explore lane rather than a destination. */
  isLane: boolean;
}

export const JOURNEY_LANES: JourneyLaneDef[] = [
  {
    id: "creator",
    title: "Creator — host contests",
    body: "Build prediction slates with AI-drafted questions, sell pick packages, and earn.",
    currency: "cash",
    color: "creator",
    href: "/app/creator",
    isLane: false,
  },
  {
    id: "advanced",
    title: "Advanced — full market",
    body: "Here knowledge reigns supreme. Every contest, every category. Lock In to win.",
    currency: "cash",
    color: "orange",
    href: "/app",
    isLane: true,
  },
  {
    id: "beginner",
    title: "Beginner — simple & guided",
    body: "Creator picks, plain-language calls, all in coins. We teach you up to the full game, step by step.",
    currency: "coins",
    color: "creator",
    href: "/app/beginner",
    isLane: true,
  },
  {
    id: "foxpit",
    title: "The Fox Pit — practice journey",
    body: "Walk into the Pit. Choose the floor, face the boss, run it back.",
    currency: "coins",
    color: "orange",
    href: "/app/foxpit",
    isLane: false,
  },
];

/**
 * Destinations that sit alongside the lanes on the web front door: the board and the open contests.
 * They are not lanes — they do not get persisted as a journey — so they are kept separate rather
 * than smuggled into JOURNEY_LANES with isLane: false.
 */
export const WEB_DESTINATIONS: JourneyLaneDef[] = [
  {
    id: "leaderboard",
    title: "Leaderboards — the board",
    body: "Today, this week, all time. Cash won, win rate, and the streak behind it.",
    currency: "cash",
    color: "fox",
    href: "/app/leaderboard",
    isLane: false,
  },
  {
    id: "contests",
    title: "Contests — every slate live now",
    body: "One topic, three legs, a published close time. Pick your seat.",
    currency: "cash",
    color: "orange",
    href: "/app",
    isLane: false,
  },
];

/** Lanes for a surface. Web is cash-only; mobile keeps everything. */
export function lanesForSurface(surface: "web" | "mobile"): JourneyLaneDef[] {
  return surface === "web"
    ? JOURNEY_LANES.filter((l) => l.currency === "cash")
    : JOURNEY_LANES;
}

/** The full web front door: cash lanes, then the board and the contest list. */
export function webFrontDoor(): JourneyLaneDef[] {
  return [...lanesForSurface("web"), ...WEB_DESTINATIONS];
}
