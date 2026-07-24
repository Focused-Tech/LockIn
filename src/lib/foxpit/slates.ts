/**
 * FOX PIT — boss-journey COIN slates. Fully self-contained content + generation;
 * nothing here touches the real-money feed, Explore, or the practice-arena pool.
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";
import {
  ROOM_RULES,
  SLATES_PER_ROUND,
  FOXPIT_CATEGORIES,
  REAL_DATA_ENTERS_AT,
  CARD_DISTRIBUTION,
  type FoxPitCategory,
} from "./rules";

export interface FoxQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  /** The house AI's read (0–100) on option A. */
  aiConfidence: number;
  /** Hidden truth, rolled at deal time. */
  outcome: "a" | "b";
}

export interface FoxSlate {
  id: string;
  category: FoxPitCategory;
  title: string;
  realData: boolean;
  questions: FoxQuestion[];
  /** Coin stake the player assigns (null until staked). */
  stake: number | null;
}

/** Canned question bank per category — Fox Pit's OWN content. */
const BANK: Record<FoxPitCategory, { title: string; q: [string, string, string, number][] }[]> = {
  music: [
    { title: "Chart Watch", q: [
      ["Will the #1 single hold the top spot next week?", "Holds", "Drops", 55],
      ["Does the surprise-drop album debut in the Top 3?", "Top 3", "Outside", 60],
      ["Will the tour add a second night in the biggest market?", "Adds", "No add", 48],
    ] },
    { title: "Award Season", q: [
      ["Does the frontrunner sweep the vocal category?", "Sweeps", "Upset", 62],
      ["Will a debut act win a major?", "Yes", "No", 40],
    ] },
  ],
  entertainment: [
    { title: "Box Office", q: [
      ["Does the tentpole clear its opening-weekend target?", "Clears", "Misses", 58],
      ["Will the streaming rival top the weekend charts?", "Tops", "No", 45],
      ["Sequel out-earns the original opening?", "Out-earns", "Under", 52],
    ] },
    { title: "Renewal Watch", q: [
      ["Does the hit series get renewed before the finale?", "Renewed", "Waits", 66],
      ["Will the spin-off be announced this month?", "Announced", "No", 43],
    ] },
  ],
  sports: [
    { title: "World Cup Group Stage", q: [
      ["Does the favorite win their opener?", "Wins", "Draw/Loss", 63],
      ["Over 2.5 goals in the marquee match?", "Over", "Under", 50],
      ["Does the dark horse advance from the group?", "Advances", "Out", 47],
    ] },
    { title: "Knockout Round", q: [
      ["Match decided in regulation?", "Regulation", "Extra time", 55],
      ["Golden Boot leader scores again?", "Scores", "Blank", 58],
      ["Underdog forces penalties?", "Penalties", "No", 41],
    ] },
  ],
  politics: [
    { title: "The Vote", q: [
      ["Does the incumbent hold the lead into the weekend?", "Holds", "Slips", 54],
      ["Turnout beats the prior cycle?", "Beats", "Under", 49],
    ] },
    { title: "The Floor", q: [
      ["Does the bill clear committee this week?", "Clears", "Stalls", 57],
      ["A surprise cross-party amendment passes?", "Passes", "Fails", 38],
    ] },
  ],
  crypto: [
    { title: "Majors", q: [
      ["Does BTC close the week green?", "Green", "Red", 52],
      ["ETH outperforms BTC over 7 days?", "Outperforms", "Under", 48],
      ["A top-10 alt flips its neighbor by market cap?", "Flips", "No", 44],
    ] },
    { title: "Catalysts", q: [
      ["Does the ETF see net inflows this week?", "Inflows", "Outflows", 60],
      ["A major L2 ships its upgrade on schedule?", "On time", "Delayed", 46],
    ] },
  ],
  weather: [
    { title: "The Front", q: [
      ["Does the storm track make landfall as forecast?", "As forecast", "Shifts", 56],
      ["Record heat holds through the weekend?", "Holds", "Breaks", 51],
    ] },
    { title: "The Outlook", q: [
      ["Does the region beat its rainfall normal this week?", "Beats", "Under", 49],
      ["First frost arrives before month-end?", "Before", "After", 45],
    ] },
  ],
};

/** Questions per slate grows with room difficulty. */
function questionsPerSlate(room: FoxPitRoomKey): number {
  return { dojo: 2, coliseum: 3, hightable: 3, suite: 4 }[room];
}

/** Roll a hidden outcome weighted by the AI's confidence on A. */
function rollOutcome(aiConfidenceA: number): "a" | "b" {
  return Math.random() * 100 < aiConfidenceA ? "a" : "b";
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

/** Which categories are in play for this room (real-data enters at Raven). */
export function categoriesFor(room: FoxPitRoomKey): FoxPitCategory[] {
  const floorReached = ROOM_RULES[room].floor >= ROOM_RULES[REAL_DATA_ENTERS_AT].floor;
  // sports (World Cup real-data) only enters at Raven+; before that, the lighter mix.
  return FOXPIT_CATEGORIES.filter((c) => (c === "sports" ? floorReached : true));
}

function buildSlate(room: FoxPitRoomKey, category: FoxPitCategory): FoxSlate {
  const options = BANK[category];
  const template = options[Math.floor(Math.random() * options.length)]!;
  const want = questionsPerSlate(room);
  const pool = [...template.q];
  const questions: FoxQuestion[] = [];
  for (let i = 0; i < want; i++) {
    const [text, optionA, optionB, conf] = pool[i % pool.length]!;
    questions.push({ id: uid("q"), text, optionA, optionB, aiConfidence: conf, outcome: rollOutcome(conf) });
  }
  return {
    id: uid("slate"),
    category,
    title: template.title,
    realData: category === "sports",
    questions,
    stake: null,
  };
}

/**
 * Deal the round's 5 slates for a room.
 *
 * `hedged` = the categories the player picked in the category-select beat. When
 * present the draw is restricted to them (that IS the hedge); empty/omitted falls
 * back to the room's full pool, which is what Boss Fox gets since he has no hedge.
 */
export function dealFoxSlates(room: FoxPitRoomKey, hedged: FoxPitCategory[] = []): FoxSlate[] {
  const pool = categoriesFor(room);
  const cats = hedged.length ? hedged.filter((c) => pool.includes(c)) : pool;
  const draw = cats.length ? cats : pool;
  const out: FoxSlate[] = [];
  for (let i = 0; i < SLATES_PER_ROUND; i++) {
    out.push(buildSlate(room, draw[Math.floor(Math.random() * draw.length)]!));
  }
  return out;
}

/**
 * Deal the round's 5 slates spread across the CHOSEN categories per CARD_DISTRIBUTION (new model):
 * 1 cat → 5 of it; 2 → 3/2; 3 → 2/2/1; 4 → 2/1/1/1; 5 → one each. Breadth is the player's own risk
 * choice, so any category is valid on any floor.
 */
export function dealFoxSlatesByCategories(room: FoxPitRoomKey, chosen: FoxPitCategory[]): FoxSlate[] {
  const cats = chosen.length ? chosen : categoriesFor(room);
  const n = Math.max(1, Math.min(cats.length, 5));
  const split = CARD_DISTRIBUTION[n] ?? [SLATES_PER_ROUND];
  const out: FoxSlate[] = [];
  split.forEach((count, i) => {
    const cat = cats[i % cats.length]!;
    for (let k = 0; k < count; k++) out.push(buildSlate(room, cat));
  });
  return out;
}

/** A slate is WON when the player gets at least half its questions right. */
export function slateWon(slate: FoxSlate, picks: Record<string, "a" | "b">): boolean {
  let correct = 0;
  for (const q of slate.questions) if (picks[q.id] === q.outcome) correct += 1;
  return correct >= Math.ceil(slate.questions.length / 2);
}

/** $-weighted round score: sum of stakes on WON slates. */
export function roundScore(slates: FoxSlate[], picks: Record<string, "a" | "b">): number {
  return slates.reduce((sum, s) => (s.stake && slateWon(s, picks) ? sum + s.stake : sum), 0);
}

/** Boss stake mode (item 4): MATCH = boss stakes at the player's own tier per card; TOP = boss
 *  stakes at the room's highest tier on every card (harder to out-score, bigger pot). */
export type BossStakeMode = "match" | "top";

/** The boss's simulated round score. He plays EXACTLY the player's cards (one per `playedStakes`
 *  entry), each won at the boss win%. In MATCH he stakes what the player staked on that card; in
 *  TOP he stakes the room's highest tier on every card. Gates advancement, not coin-banking. */
export function bossRoundScore(room: FoxPitRoomKey, playedStakes: number[], mode: BossStakeMode): number {
  const { bossWinPct, stakes } = ROOM_RULES[room];
  const topStake = stakes[stakes.length - 1]!;
  let score = 0;
  for (const st of playedStakes) {
    const bossStake = mode === "top" ? topStake : st;
    if (Math.random() * 100 < bossWinPct) score += bossStake;
  }
  return score;
}
