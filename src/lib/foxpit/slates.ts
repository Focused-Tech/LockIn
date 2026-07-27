/**
 * FOX PIT — boss-journey COIN slates. Fully self-contained content + generation;
 * nothing here touches the real-money feed, Explore, or the practice-arena pool.
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";
import type { TriviaQuestion } from "@/lib/foxpit/trivia";
import {
  SLATES_PER_ROUND,
  FOXPIT_CATEGORIES,
  CARD_DISTRIBUTION,
  type FoxPitCategory,
} from "./rules";

export interface FoxQuestion {
  id: string;
  text: string;
  /** 4 answer options (settled-fact multiple choice); exactly one is correct. */
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
}

export interface FoxSlate {
  id: string;
  category: FoxPitCategory;
  title: string;
  realData: boolean;
  questions: FoxQuestion[];
  /** How many of `questions` the player chose to PLAY on this card (1..questions.length). Defaults to
   *  the full deal; only these count for winning + they drive the card's stake ceiling (defect 5b). */
  playCount: number;
  /** Coin stake the player assigns (null until staked). */
  stake: number | null;
}

/** Map a pooled MC question (settled past fact, 4 options) to a slate question. */
function toFoxQuestion(q: TriviaQuestion): FoxQuestion {
  return { id: q.id, text: q.question, options: q.options, correctIndex: q.correctIndex };
}

/** A card's title = the subcategory of its questions (the "Sub" of the pool's "Parent · Sub" label). */
function cardTitle(q: TriviaQuestion): string {
  const parts = q.category.split(" · ");
  return parts[parts.length - 1] ?? q.category;
}

/** MAX questions per slate, set by the FLOOR (defect 5a): Owl 1, Wolf 2, Raven 3, Fox 3 — difficulty
 *  comes from decoy quality, not question volume. (Grim/High-Table underling caps at 2 in the rules;
 *  the room's boss max governs the deal.) The PLAYER may choose to answer fewer (min 1) per card. */
export function questionsPerSlate(room: FoxPitRoomKey): number {
  return { dojo: 1, coliseum: 2, hightable: 3, suite: 3 }[room];
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}`;
}

/**
 * How many CARDS each chosen category gets this round — the CARD_DISTRIBUTION spread over `count`
 * cards across the chosen categories (1 cat → all of it; 2 → 3/2; …). The server action uses this to
 * fetch exactly `cards × questionsPerSlate` fresh questions per category from the never-repeat pool.
 */
export function cardsByCategory(chosen: FoxPitCategory[], count: number): Record<string, number> {
  const cats = chosen.length ? chosen : [...FOXPIT_CATEGORIES];
  const n = Math.max(1, Math.min(cats.length, SLATES_PER_ROUND));
  const split = CARD_DISTRIBUTION[n] ?? [SLATES_PER_ROUND];
  const out: Record<string, number> = {};
  let made = 0;
  for (let i = 0; i < split.length && made < count; i++) {
    const cat = cats[i % cats.length]!;
    const take = Math.min(split[i]!, count - made);
    out[cat] = (out[cat] ?? 0) + take;
    made += take;
  }
  return out;
}

/**
 * Build a round's slates from ALREADY-FETCHED pool questions (the server action does the Firestore
 * read + never-repeat marking; this is the pure grouping half). Cards spread across the chosen tower
 * categories per {@link cardsByCategory}; each card is `questionsPerSlate(room)` MC questions from
 * that category's fresh bucket. A dry bucket yields fewer cards — never a duplicate, never a recycle.
 */
export function buildSlatesFromPool(
  room: FoxPitRoomKey,
  chosen: FoxPitCategory[],
  count: number,
  poolByCategory: Record<string, TriviaQuestion[]>,
): FoxSlate[] {
  const qPer = questionsPerSlate(room);
  const demand = cardsByCategory(chosen, count);
  const cursor: Record<string, number> = {};
  const out: FoxSlate[] = [];
  // Deal in the chosen order so the mix matches the distribution the player sees.
  const cats = (chosen.length ? chosen : [...FOXPIT_CATEGORIES]).filter((c) => (demand[c] ?? 0) > 0);
  const remaining = { ...demand };
  let progressed = true;
  while (out.length < count && progressed) {
    progressed = false;
    for (const cat of cats) {
      if ((remaining[cat] ?? 0) <= 0 || out.length >= count) continue;
      const pool = poolByCategory[cat] ?? [];
      const start = cursor[cat] ?? 0;
      const qs = pool.slice(start, start + qPer);
      cursor[cat] = start + qs.length;
      remaining[cat] = (remaining[cat] ?? 0) - 1;
      if (qs.length === 0) continue; // this category's fresh pool ran dry
      const fq = qs.map(toFoxQuestion);
      out.push({
        id: uid("slate"),
        category: cat,
        title: cardTitle(qs[0]!),
        realData: false,
        questions: fq,
        playCount: fq.length,
        stake: null,
      });
      progressed = true;
    }
  }
  return out;
}

/** A slate is WON when the player gets at least half of the questions THEY CHOSE TO PLAY right. Only
 *  the first `playCount` questions count — the ones the player dialed off are neither scored nor held
 *  against them (defect 5b). */
export function slateWon(slate: FoxSlate, picks: Record<string, number>): boolean {
  const played = slate.questions.slice(0, Math.max(1, Math.min(slate.playCount, slate.questions.length)));
  let correct = 0;
  for (const q of played) if (picks[q.id] === q.correctIndex) correct += 1;
  return correct >= Math.ceil(played.length / 2);
}

/** Boss stake mode (item 4): MATCH = boss stakes at the player's own tier per card; TOP = boss
 *  stakes at the room's highest tier on every card (harder to out-score, bigger pot). */
export type BossStakeMode = "match" | "top";

export type CardResultKind = "win" | "loss" | "push";

/** One card's coin outcome — the reveal ledger line so the player sees exactly where each coin went. */
export interface CardLedgerLine {
  slateId: string;
  category: FoxPitCategory;
  title: string;
  playerCorrect: boolean;
  bossCorrect: boolean;
  playerStake: number;
  bossStake: number;
  /** + = player takes the boss's stake; − = boss takes the player's stake; 0 = push. */
  net: number;
  result: CardResultKind;
}

export interface RoundSettlement {
  cards: CardLedgerLine[];
  net: number;
  /** H2H cards the player took / the boss took (pushes count for neither). */
  playerCards: number;
  bossCards: number;
}

/**
 * PER-CARD HEAD-TO-HEAD settlement — the whole coin economy. No pot, no multipliers, no margin.
 * Each staked card settles ON ITS OWN against the boss:
 *   • player right & boss wrong → player TAKES the boss's stake on that card (+bossStake)
 *   • boss right & player wrong → boss TAKES the player's stake on that card (−playerStake)
 *   • both right OR both wrong  → PUSH: both stakes return, no coins move (0)
 * The boss's stake per card comes from the fight-screen mode: MATCH = the player's own tier on that
 * card, TOP = a flat `topStake` on every card. Round net = Σ per-card net. `bossCorrect` is injected
 * so the caller owns the RNG (and tests can make it deterministic).
 */
export function settleRound(
  slates: FoxSlate[],
  picks: Record<string, number>,
  mode: BossStakeMode,
  topStake: number,
  bossCorrect: (slate: FoxSlate) => boolean,
): RoundSettlement {
  const cards: CardLedgerLine[] = [];
  for (const s of slates) {
    if (s.stake == null) continue; // only cards the player actually staked/played settle
    const pc = slateWon(s, picks);
    const bc = bossCorrect(s);
    const bossStake = mode === "top" ? topStake : s.stake;
    let net = 0;
    let result: CardResultKind;
    if (pc && !bc) {
      net = bossStake; // player takes the boss's stake
      result = "win";
    } else if (bc && !pc) {
      net = -s.stake; // boss takes the player's stake
      result = "loss";
    } else {
      net = 0; // PUSH — both right or both wrong, stakes return
      result = "push";
    }
    cards.push({
      slateId: s.id,
      category: s.category,
      title: s.title,
      playerCorrect: pc,
      bossCorrect: bc,
      playerStake: s.stake,
      bossStake,
      net,
      result,
    });
  }
  return {
    cards,
    net: cards.reduce((sum, c) => sum + c.net, 0),
    playerCards: cards.filter((c) => c.result === "win").length,
    bossCards: cards.filter((c) => c.result === "loss").length,
  };
}
