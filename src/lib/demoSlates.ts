import type { FeedSlate, FeedPrediction } from "@/lib/feed";

/**
 * DEMO SLATES — two free, always-live contests pinned to the top of The Floor so any tester
 * (no wallet, no cash, no attestation) can play the pick → lock-in flow end-to-end and feel the
 * animation. They never touch Firestore or a balance; the slate page + picker special-case these
 * ids and run the flow locally (see `isDemo`). Categories: NBA + Black Entertainment.
 */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const TIERS = [
  { tier: 5 as const, hostingFeeCents: 100 },
  { tier: 10 as const, hostingFeeCents: 200 },
  { tier: 25 as const, hostingFeeCents: 300 },
];

/** Binary demo leg. Context rides on the option label after " · " so the leg card shows a cx line. */
function leg(
  id: string,
  question: string,
  a: string,
  b: string,
  probA: number,
  gameLine?: string,
): FeedPrediction {
  return {
    id,
    question,
    optionA: a,
    optionB: b,
    probA,
    probB: 100 - probA,
    type: "binary",
    line: null,
    result: null,
    gameLine: gameLine ?? null,
  };
}

export const DEMO_SLATES: FeedSlate[] = [
  {
    id: "demo-nba",
    title: "NBA — Tonight's Marquee (Demo)",
    category: "NBA",
    status: "live",
    creatorId: null,
    entryTiers: TIERS,
    entryCount: 4200,
    isCardRush: false,
    rushMultiplier: 1,
    maxEntries: null,
    // Far-future lock so the demo is always live and never settles.
    lockTimeMs: 4102462800000, // Jan 2100
    isDemo: true,
    creatorName: "LockIn",
    creatorTrackRecord: "Demo contest",
    predictions: [
      leg(
        "demo-nba-1",
        "Who scores more tonight?",
        "The visiting guard · 31.4 avg · 34 last out",
        "The home big man · 27.1 avg · 29 last out",
        55,
        "West vs East · 9:30 PM tip",
      ),
      leg(
        "demo-nba-2",
        "Does the home favorite cover the spread?",
        "Covers the number",
        "Doesn't cover",
        52,
        "Home favored by 5.5",
      ),
      leg(
        "demo-nba-3",
        "Combined total points — over or under 224.5?",
        "Over 224.5",
        "Under 224.5",
        50,
        "O/U 224.5",
      ),
    ],
  },
  {
    id: "demo-bet",
    title: "Black Entertainment — Culture Countdown (Demo)",
    category: "Black Entertainment",
    status: "live",
    creatorId: null,
    entryTiers: TIERS,
    entryCount: 3100,
    isCardRush: false,
    rushMultiplier: 1,
    maxEntries: null,
    lockTimeMs: 4102462800000,
    isDemo: true,
    creatorName: "LockIn",
    creatorTrackRecord: "Demo contest",
    predictions: [
      leg(
        "demo-bet-1",
        "Which single tops the R&B / Hip-Hop chart this week?",
        "The streaming favorite · #2 last week",
        "The radio pick · climbing fast",
        58,
      ),
      leg(
        "demo-bet-2",
        "Which series pulls the bigger weekend audience?",
        "The drama premiere",
        "The returning comedy",
        49,
      ),
      leg(
        "demo-bet-3",
        "Who takes home the night's top award?",
        "The veteran headliner",
        "The breakout newcomer",
        47,
      ),
    ],
  },
];

/** Look up a demo slate by id (used by the slate page to bypass Firestore). */
export function getDemoSlate(id: string): FeedSlate | null {
  return DEMO_SLATES.find((s) => s.id === id) ?? null;
}
