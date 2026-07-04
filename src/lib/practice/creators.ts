/**
 * AI-SIMULATED CREATORS — "training opponents" that seed the practice arena
 * before real creators exist. Each has a distinct persona/style that shapes the
 * slates they host (via the line-style hint fed to the slate engine).
 *
 * HONESTY (firewall + truth-in-labeling):
 *  - These are clearly labeled AI (see PRACTICE_CONFIG.aiCreators) and framed as
 *    training opponents — never disguised as real people.
 *  - We show a `style` DIFFICULTY/STYLE indicator, NOT a fabricated win rate.
 *    The only honest performance number would be actual simulated results; until
 *    that's aggregated we surface the style indicator instead.
 *  - All their slates settle the SAME simulated/instant way; coins are SCORE only.
 *
 * Client-safe (pure data) so the follow/feed UI can import it directly.
 */

export type AiCreatorDifficulty = "easy" | "medium" | "hard";

export interface AiCreator {
  /** Stable id, always `ai_*` (distinguishes from real-creator uids). */
  id: string;
  handle: string;
  name: string;
  avatar: string; // emoji
  /** Short persona label (e.g. "Long-shot hunter"). */
  persona: string;
  /** One-line description of how they read the board. */
  blurb: string;
  /** Categories they host in (must match CATEGORIES names). */
  categories: string[];
  /** Honest difficulty/style indicator (NOT a win rate). */
  difficulty: AiCreatorDifficulty;
  /** Human style descriptor shown on the card (clearly a style indicator). */
  styleNote: string;
  /** Line-style hint injected into the slate engine to shape their slates. */
  lineStyle: string;
  /** Per-creator accent (within brand: cayenne/coral family + a few vivid hues). */
  accent: string;
}

export const AI_CREATORS: readonly AiCreator[] = [
  {
    // House mascot — the default rival across the arena (Practice Dojo, Coliseum).
    id: "ai_lockinfox",
    handle: "lockinfox",
    name: "LockIn Fox",
    avatar: "🦊",
    persona: "House AI",
    blurb: "The house mascot. Balanced reads across every arena — your default rival.",
    categories: ["NFL", "NBA", "UFC", "MLB", "Soccer", "Crypto"],
    difficulty: "medium",
    styleNote: "Balanced reads · house AI",
    lineStyle:
      "balanced, fair lines across sports and markets with modest favorites (~55–65%); a well-rounded default opponent",
    accent: "#FF3B00",
  },
  {
    id: "ai_longshot",
    handle: "longshotluna",
    name: "Long-Shot Luna",
    avatar: "🎯",
    persona: "Long-shot hunter",
    blurb: "Hunts the live underdog — stacks low-probability legs other people fade.",
    categories: ["NFL", "NBA", "UFC", "Boxing"],
    difficulty: "hard",
    styleNote: "Hard reads · leans underdogs (~35–45% legs)",
    lineStyle:
      "sharp lines that lean toward live underdogs — at least two legs where the listed favorite is only ~35–45% likely; reward bold contrarian reads",
    accent: "#FF6A3D",
  },
  {
    id: "ai_chalk",
    handle: "chalkcarter",
    name: "Chalk Carter",
    avatar: "🛡️",
    persona: "Safe-favorites",
    blurb: "Plays the chalk. Clear favorites, clean lines — a friendly warm-up.",
    categories: ["NBA", "Soccer", "Tennis", "NFL"],
    difficulty: "easy",
    styleNote: "Easy reads · clear favorites (~70%+ legs)",
    lineStyle:
      "approachable lines with clear-favorite props — most legs have one side around 70%+; good for building confidence",
    accent: "#2DD4BF",
  },
  {
    id: "ai_crypto",
    handle: "cryptosage",
    name: "Crypto Sage",
    avatar: "🪙",
    persona: "Crypto specialist",
    blurb: "Momentum and macro on digital assets. Tight, modern lines.",
    categories: ["Crypto", "Economics"],
    difficulty: "medium",
    styleNote: "Medium reads · momentum & macro lines",
    lineStyle:
      "crypto and macro props with modest favorites (~55–65%), framed around momentum and on-chain narratives",
    accent: "#9B5DE5",
  },
  {
    id: "ai_contrarian",
    handle: "contrariancole",
    name: "Contrarian Cole",
    avatar: "🔀",
    persona: "Contrarian",
    blurb: "Fades the public. Coin-flip props with subtle traps.",
    categories: ["Politics", "Geopolitics", "Viral"],
    difficulty: "hard",
    styleNote: "Hard reads · coin-flips & traps (~50–58%)",
    lineStyle:
      "coin-flip props and at least one correlated-trap pair; fade-the-public framing with subtle edges (~50–58%)",
    accent: "#FF6A3D",
  },
  {
    id: "ai_primetime",
    handle: "primetimenova",
    name: "Prime-Time Nova",
    avatar: "🌟",
    persona: "Prime-time sports",
    blurb: "Balanced primetime slates — a bit of everything, fair lines.",
    categories: ["NFL", "NBA", "Boxing", "MLB"],
    difficulty: "medium",
    styleNote: "Medium reads · balanced primetime lines",
    lineStyle:
      "balanced primetime sports lines with modest favorites (~58–68%) and one swing leg",
    accent: "#F5A623",
  },
  {
    id: "ai_poppulse",
    handle: "poppulse",
    name: "Pop Pulse",
    avatar: "🎬",
    persona: "Culture & viral",
    blurb: "Entertainment, TV and viral moments. Reads the zeitgeist.",
    categories: ["Entertainment", "TV Shows", "Music", "Viral"],
    difficulty: "medium",
    styleNote: "Medium reads · culture & viral props",
    lineStyle:
      "pop-culture, awards, TV and viral-moment props with mixed favorites (~55–70%)",
    accent: "#FF6A3D",
  },
] as const;

export function getAiCreator(id: string): AiCreator | undefined {
  return AI_CREATORS.find((c) => c.id === id);
}

export function isAiCreatorId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("ai_");
}
