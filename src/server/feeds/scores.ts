import "server-only";

/**
 * Real final-score resolution for data-feed slates (id `espn-{league}-{eventId}`). Fetches ESPN's game
 * summary and grades each market from the actual result — retiring the mock verifier for real games.
 */

/** ESPN league slug → sport path (for the summary URL). */
const LEAGUE_SPORT: Record<string, string> = {
  mlb: "baseball",
  wnba: "basketball",
  nba: "basketball",
  nfl: "football",
  "college-football": "football",
  nhl: "hockey",
  "usa.1": "soccer",
  "eng.1": "soccer",
};

export interface GameResult {
  homeScore: number;
  awayScore: number;
  /** True only once the game is FINAL. Settlement waits for this. */
  completed: boolean;
}

/** Parse `espn-{league}-{eventId}` → sport/league/eventId (league may contain dots/dashes). */
function parseSlateId(slateId: string): { sport: string; league: string; eventId: string } | null {
  const m = slateId.match(/^espn-(.+)-(\d+)$/);
  if (!m) return null;
  const league = m[1]!;
  const sport = LEAGUE_SPORT[league];
  if (!sport) return null;
  return { sport, league, eventId: m[2]! };
}

/** Is this a data-feed slate whose result we can look up? */
export function isFeedSlateId(slateId: string): boolean {
  return parseSlateId(slateId) !== null;
}

/** Fetch the final score for a feed slate's game. null = unknown; `completed:false` = not final yet. */
export async function fetchEspnGameResult(slateId: string): Promise<GameResult | null> {
  const p = parseSlateId(slateId);
  if (!p) return null;
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${p.sport}/${p.league}/summary?event=${p.eventId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      console.error(`[feed] summary ${slateId}: HTTP ${res.status}`);
      return null;
    }
    const d = await res.json();
    const comp = d?.header?.competitions?.[0];
    if (!comp) return null;
    const st = comp.status?.type;
    const completed = st?.completed === true || st?.state === "post";
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const home = comp.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp.competitors?.find((c: any) => c.homeAway === "away");
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const homeScore = Number(home?.score);
    const awayScore = Number(away?.score);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return { homeScore: 0, awayScore: 0, completed: false };
    return { homeScore, awayScore, completed };
  } catch (err) {
    console.error("[feed] fetchEspnGameResult failed", slateId, err);
    return null;
  }
}

/** Parse a signed line from a spread option label ("Washington Nationals +1.5" → 1.5). */
function parseLine(label: string): number | null {
  const m = label.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : null;
}

/**
 * Grade one market from the final score. Returns "a" | "b", or null when it can't settle cleanly
 * (game not final, or a PUSH/tie — the caller routes those to manual review rather than guess).
 * Market ids: "ml" (moneyline / who wins), "spread" (run/point line), "total" (over/under).
 */
export function resolveFeedPrediction(
  pred: { id: string; predictionType: string; optionA: string; overUnderLine: number | null },
  r: GameResult,
): "a" | "b" | null {
  if (!r.completed) return null;
  const total = r.homeScore + r.awayScore;

  // Over/Under: optionA = Over, optionB = Under.
  if (pred.predictionType === "over_under" && pred.overUnderLine != null) {
    if (total === pred.overUnderLine) return null; // push
    return total > pred.overUnderLine ? "a" : "b";
  }

  // Spread (run/point/puck line): optionA = "{home} {±line}", optionB = "{away} {∓line}".
  if (pred.id === "spread") {
    const homeLine = parseLine(pred.optionA);
    if (homeLine == null) return null;
    const margin = r.homeScore + homeLine - r.awayScore;
    if (margin === 0) return null; // push
    return margin > 0 ? "a" : "b";
  }

  // Moneyline / who wins: optionA = home, optionB = away.
  if (r.homeScore === r.awayScore) return null; // tie / draw → review (refund)
  return r.homeScore > r.awayScore ? "a" : "b";
}
