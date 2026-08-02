/**
 * ARCHETYPE LIBRARY (§1) — the SINGLE source of the six approved cross-game archetypes. Pure logic,
 * no I/O, no server-only: BOTH consumers draw from here — the auto-feed generator (server/feeds) AND
 * the creator slate builder (app/create). Archetype logic is written ONCE.
 *
 * Each archetype exposes: its id, its stems (≥6), the games/stat it needs, the option shape it
 * produces, and a builder that takes available games + a stat + a stem and returns a VALID leg or
 * null. A builder returns null when the data can't support a compliant leg (never a leg that would
 * fail validateLeg). SETTLEMENT is NOT here — resolveArchetype (contest/archetypes.ts) grades all six.
 */
import { APPROVED_ARCHETYPES, validateLeg, type Archetype, type Leg, type EnginePlayer, type LegContext } from "./questionEngine";

// ── Normalized input pool (both consumers build one of these) ───────────────────────────────────
/** A standout player available for a stat in one game. `seasonVal` + `lastOut` are DISPLAY context
 *  (never the threshold). `boxLabel`/`leaderCat` carry through to settlement. */
export interface PoolPlayer {
  name: string;
  team: string;
  gameId: string;
  seasonVal: number;
  lastOut: string; // "" when unknown (feed); creator can supply
  stat: string; // statLabel, e.g. "points"
  boxLabel: string;
  leaderCat: string;
  /** external stat-provider id (ESPN athlete id) — the feed writes name→id so the reader can pull
   *  live context; optional for fixtures/creator rosters. */
  playerId?: string;
}
export interface PoolGame {
  gameId: string;
  startMs: number;
  gameLine: string; // "Lakers at Celtics"
  byStat: Record<string, PoolPlayer>; // statLabel -> that game's standout for the stat
}
export interface Pool {
  league: string;
  category: string;
  stats: string[]; // statLabels available across the pool
  games: PoolGame[];
}

// ── Generated leg (feeds BOTH the app render AND the settlement meta) ────────────────────────────
export interface GeneratedOption {
  key: string; // "a","b","c"… (players) or bucket keys ("b0","b1","b2")
  label: string; // the .nm — player name, duo "A + B", or bucket "Two or three"
  context: string[]; // the .cx lines — gameLine, "N stat (season)", last-out. EMPTY for milestone chips
  playerNames?: string[]; // settlement: the player(s) this option resolves across (1, or 2 for duos)
  bucket?: [number, number]; // milestone: the count range this bucket covers
}
export interface GeneratedLeg {
  archetype: Archetype;
  stem: string; // the raw stem template used (the no-repeat guard keys on archetype|stem)
  question: string;
  sub?: string; // leg sub-line — milestone_count puts the named players + context HERE, not on chips
  pickStyle: "contest" | "chips";
  options: GeneratedOption[];
  bar?: number; // first_to_n / milestone_count threshold, on the per-game composite
  countedPlayers?: string[];
  context: LegContext; // leg-level display context (validateLeg requires it present)
  players: EnginePlayer[]; // flat player list the one-per-game rule validates
  stat: string;
  boxLabel: string;
}

// ── Per-game "clear" bars for milestone/race (on the per-game box stat, NOT the season total) ─────
const STAT_BARS: Record<string, { milestone: number; race: number }> = {
  points: { milestone: 30, race: 20 },
  rebounds: { milestone: 10, race: 8 },
  assists: { milestone: 10, race: 6 },
  hits: { milestone: 2, race: 2 },
  "home runs": { milestone: 1, race: 1 },
  "passing yards": { milestone: 300, race: 200 },
  "rushing yards": { milestone: 100, race: 75 },
  goals: { milestone: 1, race: 1 },
};
const barFor = (stat: string) => STAT_BARS[stat] ?? { milestone: 1, race: 1 };

// ── Stems (§2.6 — ≥6 per archetype, matching the H2H_STEMS tone) ─────────────────────────────────
export const ARCHETYPE_STEMS: Record<Archetype, string[]> = {
  cross_game_h2h: [
    "More {stat} tonight?", "Who racks up more {stat}?", "Bigger {stat} night?",
    "Who shows out — most {stat}?", "Who takes the {stat} edge?", "Who piles up more {stat}?",
  ],
  field_leader: [
    "Who leads the floor for {stat} tonight?", "Who tops the {stat} board?", "Best {stat} night of the bunch?",
    "Who paces the field in {stat}?", "Top dog for {stat} tonight?", "Who's the {stat} leader of the night?",
  ],
  biggest_night: [
    "Who has the biggest {stat} night?", "Whose {stat} night is it?", "Who goes off for {stat}?",
    "{stat} player of the night — who?", "Who steals the show in {stat}?", "Who has the loudest {stat} night?",
  ],
  split_squad_duos: [
    "Which duo racks up more {stat}?", "Whose pair goes bigger in {stat}?", "Which two combine for more {stat}?",
    "Better {stat} duo tonight?", "Which tandem shows out in {stat}?", "Whose two-man crew wins the {stat} night?",
  ],
  milestone_count: [
    "How many clear {bar} {stat}?", "How many of them hit {bar}+ {stat}?", "How many get to {bar} {stat} tonight?",
    "How many crack {bar} {stat}?", "How many reach {bar} {stat}?", "How many post {bar}+ {stat}?",
  ],
  first_to_n: [
    "Who gets to {bar} {stat} first?", "First to {bar} {stat} tonight?", "Who hits {bar} {stat} first?",
    "Race to {bar} {stat} — who gets there?", "Who reaches {bar} {stat} first?", "First one to {bar} {stat}?",
  ],
};

// ── Shared helpers ───────────────────────────────────────────────────────────────────────────────
const ordinalName = (n: number) => ["None", "One", "Two", "Three", "Four", "Five"][n] ?? String(n);
/** three count buckets spanning 0..n: e.g. n=5 → [0,1],[2,3],[4,5]; n=3 → [0,0],[1,2],[3,3]. */
function threeBuckets(n: number): { range: [number, number]; label: string }[] {
  const a = Math.floor((n + 1) / 3);
  const b = Math.floor((2 * (n + 1)) / 3);
  const ranges: [number, number][] = [[0, a - 1], [a, b - 1], [b, n]];
  const lbl = ([lo, hi]: [number, number]) =>
    lo === hi ? ordinalName(lo) : lo === 0 ? `${ordinalName(hi)} or fewer` : hi === n ? `${ordinalName(lo)} or more` : `${ordinalName(lo)}–${ordinalName(hi)}`;
  return ranges.map((range) => ({ range, label: lbl(range) }));
}
/** a pool player with its game line attached (the .cx line "Team A at Team B"). */
type PP = PoolPlayer & { line: string };
const withLine = (p: PoolPlayer, line: string): PP => ({ ...p, line });
/** §2 standing rule — every option carries game line + season average + last-out form (present ones). */
const optionContext = (p: PP): string[] =>
  [p.line, `${p.seasonVal} ${p.stat} (season)`, p.lastOut ? `${p.lastOut} last out` : ""].filter(Boolean) as string[];

function toEngine(players: PoolPlayer[]): EnginePlayer[] {
  return players.map((p) => ({ name: p.name, gameId: p.gameId, team: p.team }));
}
function legContext(stat: string, category: string): LegContext {
  return { seasonAverage: `${stat} — season form shown per player`, last3Form: "recent form per player", matchupNote: `${category} · cross-game ${stat}` };
}

// ── The six archetype definitions ────────────────────────────────────────────────────────────────
export interface ArchetypeDef {
  id: Archetype;
  minGames: number;
  maxGames: number;
  pickStyle: "contest" | "chips";
  stems: string[];
  /** games: distinct-gameId games allocated to this leg; stat: chosen statLabel; stem: chosen template. */
  build: (games: PoolGame[], stat: string, stem: string, category: string) => GeneratedLeg | null;
}

/** pull each game's standout for `stat`; null if any game lacks it. */
function playersFor(games: PoolGame[], stat: string): PP[] | null {
  const out: PP[] = [];
  for (const g of games) {
    const p = g.byStat[stat];
    if (!p) return null;
    out.push(withLine(p, g.gameLine));
  }
  return out;
}
const fill = (stem: string, stat: string, bar?: number) => stem.replace("{stat}", stat).replace("{bar}", String(bar ?? ""));

function topComposite(id: Archetype, games: PoolGame[], stat: string, stem: string, category: string): GeneratedLeg | null {
  const ps = playersFor(games, stat);
  if (!ps || ps.length < 2) return null;
  const options: GeneratedOption[] = ps.map((p, i) => ({ key: String.fromCharCode(97 + i), label: p.name, context: optionContext(p), playerNames: [p.name] }));
  return {
    archetype: id, stem, question: fill(stem, stat), pickStyle: "contest", options,
    context: legContext(stat, category), players: toEngine(ps), stat, boxLabel: ps[0]!.boxLabel,
  };
}

export const ARCHETYPE_LIBRARY: Record<Archetype, ArchetypeDef> = {
  cross_game_h2h: {
    id: "cross_game_h2h", minGames: 2, maxGames: 2, pickStyle: "contest", stems: ARCHETYPE_STEMS.cross_game_h2h,
    build: (g, stat, stem, cat) => topComposite("cross_game_h2h", g.slice(0, 2), stat, stem, cat),
  },
  field_leader: {
    id: "field_leader", minGames: 3, maxGames: 5, pickStyle: "contest", stems: ARCHETYPE_STEMS.field_leader,
    build: (g, stat, stem, cat) => topComposite("field_leader", g, stat, stem, cat),
  },
  biggest_night: {
    id: "biggest_night", minGames: 3, maxGames: 5, pickStyle: "contest", stems: ARCHETYPE_STEMS.biggest_night,
    build: (g, stat, stem, cat) => topComposite("biggest_night", g, stat, stem, cat),
  },
  split_squad_duos: {
    id: "split_squad_duos", minGames: 4, maxGames: 4, pickStyle: "contest", stems: ARCHETYPE_STEMS.split_squad_duos,
    build: (g, stat, stem, cat) => {
      const ps = playersFor(g.slice(0, 4), stat);
      if (!ps || ps.length < 4) return null;
      const duos: [PP, PP][] = [[ps[0]!, ps[1]!], [ps[2]!, ps[3]!]];
      const options: GeneratedOption[] = duos.map(([x, y], i) => ({
        key: String.fromCharCode(97 + i),
        label: `${x.name} + ${y.name}`,
        context: [`${x.team} & ${y.team}`, `${x.seasonVal}+${y.seasonVal} ${stat} (season)`],
        playerNames: [x.name, y.name],
      }));
      return { archetype: "split_squad_duos", stem, question: fill(stem, stat), pickStyle: "contest", options,
        context: legContext(stat, cat), players: toEngine(ps), stat, boxLabel: ps[0]!.boxLabel };
    },
  },
  milestone_count: {
    id: "milestone_count", minGames: 3, maxGames: 5, pickStyle: "chips", stems: ARCHETYPE_STEMS.milestone_count,
    build: (g, stat, stem, cat) => {
      const ps = playersFor(g, stat);
      if (!ps || ps.length < 3) return null;
      const bar = barFor(stat).milestone;
      const buckets = threeBuckets(ps.length);
      const options: GeneratedOption[] = buckets.map((b, i) => ({ key: `b${i}`, label: b.label, context: [], bucket: b.range }));
      // §2.3 — names + context live in the SUB-LINE, not on the chips.
      const sub = ps.map((p) => `${p.name} (${p.line}, ${p.seasonVal} ${stat})`).join(" · ");
      return { archetype: "milestone_count", stem, question: fill(stem, stat, bar), sub, pickStyle: "chips", options,
        bar, countedPlayers: ps.map((p) => p.name), context: legContext(stat, cat), players: toEngine(ps), stat, boxLabel: ps[0]!.boxLabel };
    },
  },
  first_to_n: {
    id: "first_to_n", minGames: 2, maxGames: 4, pickStyle: "contest", stems: ARCHETYPE_STEMS.first_to_n,
    build: (g, stat, stem, cat) => {
      const ps = playersFor(g, stat);
      if (!ps || ps.length < 2) return null;
      const bar = barFor(stat).race;
      const options: GeneratedOption[] = ps.map((p, i) => ({ key: String.fromCharCode(97 + i), label: p.name, context: optionContext(p), playerNames: [p.name] }));
      return { archetype: "first_to_n", stem, question: fill(stem, stat, bar), pickStyle: "contest", options,
        bar, context: legContext(stat, cat), players: toEngine(ps), stat, boxLabel: ps[0]!.boxLabel };
    },
  },
};

/** convert a generated leg to the questionEngine Leg for validation. */
export function toEngineLeg(gen: GeneratedLeg): Leg {
  return { archetype: gen.archetype, players: gen.players, context: gen.context };
}
/** does a generated leg pass the same validateLeg the entry path runs? */
export function generatedLegOk(gen: GeneratedLeg, allowedGameIds: string[]): boolean {
  return validateLeg(toEngineLeg(gen), allowedGameIds).ok;
}

// ── §3 selection policy — a slate draws ACROSS archetypes, never one repeated ─────────────────────
/** Diverse fixed order so slates interleave 2-way / field / chips / race / duos / biggest. */
const DIVERSE_ORDER: Archetype[] = ["cross_game_h2h", "field_leader", "milestone_count", "first_to_n", "split_squad_duos", "biggest_night"];

export interface SlateLegPlan {
  leg: GeneratedLeg;
  archetype: Archetype;
  stem: string;
}
/**
 * §3.1 selection policy: walk the diverse order, DISTINCT archetypes only (never one repeated — so
 * §3.1 holds and §3.2 archetype+stem can't collide). §3.3: if the data supports only one archetype,
 * you get one leg, not the same one repeated. Games may be reused across legs (one-per-game is a
 * PER-LEG rule) but each leg prefers games the previous leg didn't use, to vary the names shown.
 */
export function buildSlateLegs(pool: Pool, opts: { maxLegs?: number } = {}): SlateLegPlan[] {
  const maxLegs = opts.maxLegs ?? 6;
  const stats = pool.stats.length ? pool.stats : Array.from(new Set(pool.games.flatMap((g) => Object.keys(g.byStat))));
  if (!stats.length) return [];
  const plans: SlateLegPlan[] = [];
  const usedCombo = new Set<string>(); // `${archetype}|${stem}` — §3.2
  let statIdx = 0;
  let prevGameIds = new Set<string>();

  for (const id of DIVERSE_ORDER) {
    if (plans.length >= maxLegs) break;
    const def = ARCHETYPE_LIBRARY[id];
    const stat = stats[statIdx % stats.length]!;
    const games = allocateGames(pool, def.minGames, def.maxGames, stat, prevGameIds);
    if (!games) continue;
    const stem = def.stems.find((s) => !usedCombo.has(`${id}|${s}`)) ?? null;
    if (!stem) continue;
    const leg = def.build(games, stat, stem, pool.category);
    if (!leg || !generatedLegOk(leg, pool.games.map((g) => g.gameId))) continue;
    plans.push({ leg, archetype: id, stem });
    usedCombo.add(`${id}|${stem}`);
    prevGameIds = new Set(games.map((g) => g.gameId));
    statIdx++;
  }
  return plans;
}

/** pick min..max games that all have `stat`, preferring games NOT in `avoid`; null if < min available. */
function allocateGames(pool: Pool, min: number, max: number, stat: string, avoid: Set<string>): PoolGame[] | null {
  const eligible = pool.games.filter((g) => g.byStat[stat]);
  if (eligible.length < min) return null;
  const fresh = eligible.filter((g) => !avoid.has(g.gameId));
  const reuse = eligible.filter((g) => avoid.has(g.gameId));
  const ordered = [...fresh, ...reuse]; // prefer fresh games, fall back to reuse
  const take = ordered.slice(0, Math.min(max, ordered.length));
  return take.length >= min ? take : null;
}

export { APPROVED_ARCHETYPES };

// ── §4 — the CREATOR consumer. The builder offers these six choices (from THIS library), and validates
//    each authored leg with the SAME validateLeg (Lockpick) that names the per-archetype fix. ──────────
const ARCHETYPE_LABELS: Record<Archetype, { label: string; blurb: string }> = {
  cross_game_h2h: { label: "Head-to-head", blurb: "Two stars from two different games — who has the bigger night." },
  field_leader: { label: "Field leader", blurb: "3–5 stars, each from a different game — who leads the floor." },
  biggest_night: { label: "Biggest night", blurb: "Player of the night across 3–5 different games." },
  split_squad_duos: { label: "Split-squad duos", blurb: "Two duos, each straddling two games — duo vs duo." },
  milestone_count: { label: "Milestone count", blurb: "How many of the named players clear the bar — three buckets." },
  first_to_n: { label: "First to N", blurb: "Which star reaches the number first across separate games." },
};
export interface ArchetypeChoice {
  id: Archetype;
  label: string;
  blurb: string;
  minGames: number;
  maxGames: number;
  pickStyle: "contest" | "chips";
}
/** All six approved archetypes as creator-selectable choices — the single source the builder renders. */
export const ARCHETYPE_CHOICES: ArchetypeChoice[] = APPROVED_ARCHETYPES.map((id) => ({
  id, label: ARCHETYPE_LABELS[id].label, blurb: ARCHETYPE_LABELS[id].blurb,
  minGames: ARCHETYPE_LIBRARY[id].minGames, maxGames: ARCHETYPE_LIBRARY[id].maxGames, pickStyle: ARCHETYPE_LIBRARY[id].pickStyle,
}));

/** LOCKPICK (§4.2) — the creator-side leg validation. Same validateLeg the entry path runs, so the
 *  "two from one game — drop one, or swap to X" fix-naming fires for EVERY archetype, not just h2h. */
export function lockpickLeg(leg: Leg, allowedGameIds: string[]) {
  return validateLeg(leg, allowedGameIds);
}

/** The stats a creator can build a leg on (basketball feed). boxLabel carries to settlement. */
export const CREATOR_STATS: { stat: string; boxLabel: string }[] = [
  { stat: "points", boxLabel: "PTS" },
  { stat: "rebounds", boxLabel: "REB" },
  { stat: "assists", boxLabel: "AST" },
];
export interface CreatorPlayer { name: string; team: string; gameId: string; playerId: string }
/**
 * §4 — build a leg from the creator's CHOSEN players (one per game) for an archetype, by wrapping each
 * player as a one-stat PoolGame and running the SAME library builder the feed uses (one source of
 * truth). seasonVal is 0 here — the creator leg's per-option context is pulled LIVE from the player's
 * id at read time (getPlayerContext), so nothing is fabricated. Returns null (or a validateLeg-failing
 * leg the caller rejects) when the players don't support the archetype.
 */
export function buildCreatorLeg(archetype: Archetype, players: CreatorPlayer[], stat: string, stem: string, category: string): GeneratedLeg | null {
  const boxLabel = CREATOR_STATS.find((s) => s.stat === stat)?.boxLabel ?? "PTS";
  const games: PoolGame[] = players.map((p, i) => ({
    gameId: p.gameId, startMs: i, gameLine: p.team,
    byStat: { [stat]: { name: p.name, team: p.team, gameId: p.gameId, seasonVal: 0, lastOut: "", stat, boxLabel, leaderCat: stat, playerId: p.playerId } },
  }));
  return ARCHETYPE_LIBRARY[archetype].build(games, stat, stem, category);
}
