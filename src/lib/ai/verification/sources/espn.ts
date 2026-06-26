import type { PredictionInput, SourceVote, VerificationSource } from "../types";
import { fetchJsonWithTimeout, labelMatchesTeam } from "./util";

/** Category → ESPN scoreboard path (team sports with public endpoints). */
const ESPN_PATHS: Record<string, string> = {
  NFL: "football/nfl",
  NBA: "basketball/nba",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
  Soccer: "soccer/eng.1",
};

interface EspnCompetitor {
  team?: { displayName?: string; shortDisplayName?: string; abbreviation?: string };
  winner?: boolean;
}
interface EspnEvent {
  status?: { type?: { completed?: boolean } };
  competitions?: { competitors?: EspnCompetitor[] }[];
}

function teamNames(c: EspnCompetitor): string[] {
  return [
    c.team?.displayName ?? "",
    c.team?.shortDisplayName ?? "",
    c.team?.abbreviation ?? "",
  ].filter(Boolean);
}

/**
 * ESPN public scoreboard — authoritative for "who wins" binary questions in
 * supported team sports. Matches a completed game whose competitors map to the
 * two option labels, and votes for the winner's side. Returns null when no
 * completed, unambiguously-matching game is found (→ routes to manual review).
 */
export const espnSource: VerificationSource = {
  name: "espn",
  supports(input: PredictionInput) {
    return input.predictionType === "binary" && input.category in ESPN_PATHS;
  },
  async resolve(input): Promise<SourceVote | null> {
    const path = ESPN_PATHS[input.category];
    if (!path) return null;

    const data = (await fetchJsonWithTimeout(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`,
    ).catch(() => null)) as { events?: EspnEvent[] } | null;
    if (!data?.events) return null;

    for (const event of data.events) {
      if (!event.status?.type?.completed) continue;
      const competitors = event.competitions?.[0]?.competitors ?? [];
      if (competitors.length !== 2) continue;

      // Each competitor must map to exactly one distinct option label.
      const aTeam = competitors.find((c) =>
        labelMatchesTeam(input.optionA, ...teamNames(c)),
      );
      const bTeam = competitors.find((c) =>
        labelMatchesTeam(input.optionB, ...teamNames(c)),
      );
      if (!aTeam || !bTeam || aTeam === bTeam) continue;

      const winner = competitors.find((c) => c.winner);
      if (!winner) continue;
      const choice: "a" | "b" = winner === aTeam ? "a" : "b";
      const winnerName = teamNames(winner)[0] ?? "winner";
      return {
        source: "espn",
        choice,
        confidence: 0.99,
        detail: `ESPN: ${winnerName} won (final)`,
      };
    }
    return null;
  },
};
