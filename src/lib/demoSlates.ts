import type { FeedSlate, FeedPrediction } from "@/lib/feed";

/**
 * DEMO SLATES — two free, always-live contests pinned to the top of The Floor so any tester
 * (no wallet, no cash, no attestation) can play the pick → lock-in flow end-to-end and feel the
 * animation. They never touch Firestore or a balance; the slate page runs them locally (isDemo).
 *
 * ROTATION: each replay serves a FRESH set of questions with ONE MORE leg than the last, growing
 * 2 → 3 → 4 → 5 (then holding at 5, still rotating). No question repeats until the pool is spent.
 * Questions are drawn, interleaved, from the demo's subcategories:
 *   demo-nba  → NBA · NFL · MLB
 *   demo-bet  → hip hop · R&B · reality TV · Black reality TV
 */

const TIERS = [
  { tier: 5 as const, hostingFeeCents: 100 },
  { tier: 10 as const, hostingFeeCents: 200 },
  { tier: 25 as const, hostingFeeCents: 300 },
];

export const DEMO_START_LEGS = 2;
export const DEMO_MAX_LEGS = 5;

export interface DemoQuestion {
  id: string;
  sub: string;
  question: string;
  a: string;
  b: string;
  probA: number;
  gameLine?: string;
}

/**
 * The question bank, ordered in ROUNDS (one per subcategory) so filtering by a demo's subcategories
 * yields an interleaved mix. Phrasing is generic — no claims about real people or real records.
 */
const POOL: DemoQuestion[] = [
  // ── round 1 ──
  { id: "nba-1", sub: "NBA", question: "Who scores more tonight?", a: "The visiting guard · 31.4 avg · 34 last out", b: "The home big man · 27.1 avg · 29 last out", probA: 55, gameLine: "West vs East · 9:30 PM tip" },
  { id: "nfl-1", sub: "NFL", question: "Who throws for more yards?", a: "The home QB · 268 avg", b: "The visiting QB · 244 avg", probA: 51, gameLine: "Sunday · 1:00 PM" },
  { id: "mlb-1", sub: "MLB", question: "Which team scores first?", a: "The home side", b: "The visitors", probA: 51, gameLine: "First pitch 7:05 PM" },
  { id: "hh-1", sub: "hip hop", question: "Which single tops the Hip-Hop chart this week?", a: "The streaming favorite · #2 last week", b: "The radio pick · climbing fast", probA: 57 },
  { id: "rb-1", sub: "R&B", question: "Which R&B single climbs higher this week?", a: "The slow jam", b: "The uptempo cut", probA: 54 },
  { id: "rt-1", sub: "reality TV", question: "Which reality premiere pulls the bigger audience?", a: "The returning hit", b: "The new series", probA: 55 },
  { id: "brt-1", sub: "Black reality TV", question: "Which cast reunion trends first this weekend?", a: "The veteran cast", b: "The new cast", probA: 53 },

  // ── round 2 ──
  { id: "nba-2", sub: "NBA", question: "Does the home favorite cover the spread?", a: "Covers the number", b: "Doesn't cover", probA: 52, gameLine: "Home favored by 5.5" },
  { id: "nfl-2", sub: "NFL", question: "Does the favorite cover the spread?", a: "Covers", b: "Doesn't cover", probA: 50, gameLine: "Favorite −3.5" },
  { id: "mlb-2", sub: "MLB", question: "Over or under 8.5 total runs?", a: "Over 8.5", b: "Under 8.5", probA: 50, gameLine: "O/U 8.5" },
  { id: "hh-2", sub: "hip hop", question: "Which album debuts higher on Friday?", a: "The veteran's project", b: "The newcomer's drop", probA: 52 },
  { id: "rb-2", sub: "R&B", question: "Which vocalist tops the R&B chart?", a: "The veteran", b: "The rising star", probA: 51 },
  { id: "rt-2", sub: "reality TV", question: "Which show trends #1 this weekend?", a: "The competition show", b: "The dating show", probA: 50 },
  { id: "brt-2", sub: "Black reality TV", question: "Which returning series wins the ratings night?", a: "The franchise flagship", b: "The spinoff", probA: 52 },

  // ── round 3 ──
  { id: "nba-3", sub: "NBA", question: "Combined points — over or under 224.5?", a: "Over 224.5", b: "Under 224.5", probA: 50, gameLine: "O/U 224.5" },
  { id: "nfl-3", sub: "NFL", question: "Which team scores first?", a: "The home side", b: "The visitors", probA: 52 },
  { id: "mlb-3", sub: "MLB", question: "Does the starter record 6+ strikeouts?", a: "6 or more", b: "5 or fewer", probA: 47 },
  { id: "hh-3", sub: "hip hop", question: "Which verse racks up more streams this week?", a: "The opener", b: "The closer", probA: 50 },
  { id: "rb-3", sub: "R&B", question: "Which ballad trends first this weekend?", a: "The lead single", b: "The deep cut", probA: 50 },
  { id: "rt-3", sub: "reality TV", question: "Which finale draws more viewers?", a: "The competition finale", b: "The drama finale", probA: 51 },
  { id: "brt-3", sub: "Black reality TV", question: "Which premiere dominates social buzz?", a: "The flagship premiere", b: "The new spinoff", probA: 50 },

  // ── round 4 ──
  { id: "nba-4", sub: "NBA", question: "Which side leads at halftime?", a: "The home team", b: "The visitors", probA: 53 },
  { id: "nfl-4", sub: "NFL", question: "Total points — over or under 44.5?", a: "Over 44.5", b: "Under 44.5", probA: 49, gameLine: "O/U 44.5" },
  { id: "mlb-4", sub: "MLB", question: "Which side hits the first home run?", a: "The home side", b: "The visitors", probA: 50 },
  { id: "hh-4", sub: "hip hop", question: "Who drops the next surprise project?", a: "The headliner", b: "The rookie", probA: 48 },
  { id: "rb-4", sub: "R&B", question: "Which duet gets more spins this week?", a: "The classic pairing", b: "The new collab", probA: 49 },

  // ── round 5 ──
  { id: "nba-5", sub: "NBA", question: "Does the game reach overtime?", a: "Yes — overtime", b: "No overtime", probA: 22 },
  { id: "nfl-5", sub: "NFL", question: "Does the game go to overtime?", a: "Yes", b: "No", probA: 20 },
  { id: "mlb-5", sub: "MLB", question: "Extra innings?", a: "Yes", b: "No", probA: 18 },

  // ── round 6 ──
  { id: "nba-6", sub: "NBA", question: "Who logs a double-double first?", a: "The point guard", b: "The center", probA: 46 },
];

const DEMO_SUBS: Record<string, string[]> = {
  "demo-nba": ["NBA", "NFL", "MLB"],
  "demo-bet": ["hip hop", "R&B", "reality TV", "Black reality TV"],
};

function toPrediction(q: DemoQuestion): FeedPrediction {
  return {
    id: q.id,
    question: q.question,
    optionA: q.a,
    optionB: q.b,
    probA: q.probA,
    probB: 100 - q.probA,
    type: "binary",
    line: null,
    result: null,
    gameLine: q.gameLine ?? null,
  };
}

/**
 * Build the next set of demo predictions: `legs` questions from the demo's subcategories that
 * aren't in `seen`. When the pool can't cover `legs` fresh questions, the cycle resets (seen
 * cleared) so play can continue — the caller should clear its seen store when this happens.
 */
export function buildDemoPredictions(
  demoId: string,
  legs: number,
  seen: string[],
): { predictions: FeedPrediction[]; cycled: boolean } {
  const subs = DEMO_SUBS[demoId] ?? [];
  const pool = POOL.filter((q) => subs.includes(q.sub));
  let unseen = pool.filter((q) => !seen.includes(q.id));
  let cycled = false;
  if (unseen.length < legs) {
    unseen = pool; // pool spent — start a fresh cycle
    cycled = true;
  }
  return { predictions: unseen.slice(0, legs).map(toPrediction), cycled };
}

/** Base demo slates for the feed (id, title, category) + a starter 2-leg preview for the card. */
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
    lockTimeMs: 4102462800000, // Jan 2100 — always live
    isDemo: true,
    creatorName: "LockIn",
    creatorTrackRecord: "Demo contest",
    predictions: buildDemoPredictions("demo-nba", DEMO_START_LEGS, []).predictions,
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
    predictions: buildDemoPredictions("demo-bet", DEMO_START_LEGS, []).predictions,
  },
];

/** Base metadata (without predictions dependence) for a demo id — used by the slate page. */
export function getDemoSlate(id: string): FeedSlate | null {
  return DEMO_SLATES.find((s) => s.id === id) ?? null;
}
