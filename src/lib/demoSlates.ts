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

// Canon slate length is five or six legs — demos open at five.
export const DEMO_START_LEGS = 5;
export const DEMO_MAX_LEGS = 6;

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
/**
 * COMPLIANT demo questions — NO scores, player props, spreads, or over/unders (banned shapes). Sports
 * legs NAME the event / matchup / storyline; entertainment legs name the show, artist, or cast. Every
 * question's context matches its OWN subcategory (no baseball line on a basketball card). Generic
 * phrasing — no claims about real people or real records. These pass the same validator the seed uses.
 */
const POOL: DemoQuestion[] = [
  // ── NBA (event / storyline naming — never scores or props) ──
  { id: "nba-1", sub: "NBA", question: "Which NBA matchup is tonight's marquee?", a: "The West Coast rivalry", b: "The East Coast showdown", probA: 55, gameLine: "NBA · tonight" },
  { id: "nba-2", sub: "NBA", question: "Which storyline leads NBA coverage tonight?", a: "The star's return from injury", b: "The rookie phenom's showcase", probA: 52, gameLine: "NBA · tonight" },
  { id: "nba-3", sub: "NBA", question: "Which broadcast game draws the bigger audience?", a: "The primetime doubleheader opener", b: "The late West Coast game", probA: 51, gameLine: "NBA · national TV" },
  { id: "nba-4", sub: "NBA", question: "Which road trip is the week's NBA headline?", a: "The contender's five-game gauntlet", b: "The upstart's statement swing", probA: 53, gameLine: "NBA · this week" },
  { id: "nba-5", sub: "NBA", question: "Which subplot gets more airtime tonight?", a: "The MVP race", b: "The playoff-seeding chase", probA: 50, gameLine: "NBA · tonight" },
  { id: "nba-6", sub: "NBA", question: "Which debut is the talk of the league this week?", a: "The trade-deadline arrival", b: "The two-way call-up", probA: 49, gameLine: "NBA · this week" },

  // ── hip hop ──
  { id: "hh-1", sub: "hip hop", question: "Which release is the bigger drop this Friday?", a: "The veteran's album", b: "The newcomer's mixtape", probA: 55, gameLine: "New music Friday" },
  { id: "hh-2", sub: "hip hop", question: "Which single climbs the Hip-Hop chart higher this week?", a: "The streaming favorite", b: "The radio pick", probA: 52, gameLine: "Hip-Hop chart · this week" },
  // ── R&B ──
  { id: "rb-1", sub: "R&B", question: "Which R&B act headlines the week's playlist?", a: "The veteran vocalist", b: "The rising star", probA: 54, gameLine: "R&B · this week" },
  { id: "rb-2", sub: "R&B", question: "Which duet gets more spins this week?", a: "The classic pairing", b: "The new collab", probA: 51, gameLine: "R&B · this week" },
  // ── reality TV ──
  { id: "rt-1", sub: "reality TV", question: "Which reality premiere is the talk of the week?", a: "The returning franchise flagship", b: "The buzzy new series", probA: 55, gameLine: "Reality TV · premiere week" },
  { id: "rt-2", sub: "reality TV", question: "Which cast member drives this week's drama?", a: "The veteran instigator", b: "The newcomer stirring the pot", probA: 50, gameLine: "Reality TV · this week" },
  { id: "rt-3", sub: "reality TV", question: "Which cliffhanger gets more buzz this weekend?", a: "The competition finale", b: "The dating-show twist", probA: 51, gameLine: "Reality TV · weekend" },
  // ── Black reality TV ──
  { id: "brt-1", sub: "Black reality TV", question: "Which premiere dominates social this weekend?", a: "The franchise flagship", b: "The new spinoff", probA: 53, gameLine: "Reality TV · weekend" },
  { id: "brt-2", sub: "Black reality TV", question: "Which cast storyline leads the week?", a: "The longtime-friends fallout", b: "The new alliance", probA: 50, gameLine: "Reality TV · this week" },
];

const DEMO_SUBS: Record<string, string[]> = {
  // Pure NBA (no cross-sport context mismatch); entertainment demo interleaves its subcategories.
  "demo-nba": ["NBA"],
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
