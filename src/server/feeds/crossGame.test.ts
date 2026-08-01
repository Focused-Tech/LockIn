/**
 * GATE — cross-game head-to-head feed. The compliant transform of ESPN data: standout players paired
 * across DIFFERENT games, questions that pass the banned-archetype detector, and box-score grading.
 */
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { buildCrossGameSlate, pickTopPlayer, resolveH2H, extractAthleteStat, summaryCompleted, type FeedGame } from "./crossGame";
import { detectBannedArchetype } from "@/lib/contest/questionEngine";

const log = (m: string) => console.log(m); // eslint-disable-line no-console

const game = (id: string, startMs: number, aName: string, aVal: number, aId: string, bName: string, bVal: number, bId: string): FeedGame => ({
  eventId: id,
  startMs,
  homeName: aName,
  awayName: bName,
  competitors: [
    { team: { displayName: `${aName} FC` }, leaders: [{ name: "goals", leaders: [{ athlete: { id: aId, displayName: aName }, value: aVal }] }] },
    { team: { displayName: `${bName} FC` }, leaders: [{ name: "goals", leaders: [{ athlete: { id: bId, displayName: bName }, value: bVal }] }] },
  ],
});

// a game whose competitors expose MULTIPLE leader categories (points/rebounds/assists).
const nbaGame = (id: string, startMs: number, name: string): FeedGame => ({
  eventId: id, startMs, homeName: `${name} A`, awayName: `${name} B`,
  competitors: [
    { team: { displayName: `${name} Home` }, leaders: [
      { name: "points", leaders: [{ athlete: { id: `${id}p`, displayName: `${name} Scorer` }, value: 28 }] },
      { name: "rebounds", leaders: [{ athlete: { id: `${id}r`, displayName: `${name} Board` }, value: 11 }] },
      { name: "assists", leaders: [{ athlete: { id: `${id}a`, displayName: `${name} Dime` }, value: 8 }] },
    ] },
    { team: { displayName: `${name} Away` }, leaders: [
      { name: "points", leaders: [{ athlete: { id: `${id}p2`, displayName: `${name} Two` }, value: 20 }] },
      { name: "rebounds", leaders: [{ athlete: { id: `${id}r2`, displayName: `${name} Two` }, value: 7 }] },
      { name: "assists", leaders: [{ athlete: { id: `${id}a2`, displayName: `${name} Two` }, value: 5 }] },
    ] },
  ],
});

describe("cross-game builder — compliant, one player per game, NO repeated question", () => {
  it("pairs standout players across different games; questions vary + pass the detector", () => {
    const games = [
      game("g1", 3000, "Owusu", 9, "1", "Mihailovic", 4, "2"),
      game("g2", 1000, "Messi", 12, "3", "Suárez", 7, "4"),
      game("g3", 2000, "Haaland", 15, "5", "Foden", 6, "6"),
      game("g4", 4000, "Salah", 11, "7", "Núñez", 5, "8"),
    ];
    const slate = buildCrossGameSlate({ league: "usa.1", category: "Soccer", games })!;
    log(`slate: ${slate.slateId} · "${slate.title}" · ${slate.legs.length} legs`);
    expect(slate.slateId).toBe("h2h-usa.1");
    expect(slate.lockMs).toBe(1000);
    expect(slate.legs.length).toBeGreaterThanOrEqual(2);

    for (const leg of slate.legs) {
      const banned = detectBannedArchetype(leg.question, [leg.optionA, leg.optionB]);
      log(`  leg: "${leg.question}" | ${leg.optionA}  vs  ${leg.optionB} | banned=${banned}`);
      expect(banned).toBeNull();
      expect(leg.h2h.a.eventId).not.toBe(leg.h2h.b.eventId);
      expect(leg.optionA).toMatch(/season/);
    }
    // §3.4 / §6.3 — NEVER the same question stem twice on a slate.
    const stems = slate.legs.map((l) => l.question);
    log(`§6.3 stems on the slate: ${JSON.stringify(stems)} · all unique: ${new Set(stems).size === stems.length}`);
    expect(new Set(stems).size).toBe(stems.length);
  });

  it("draws across MULTIPLE stats when the league exposes them (NBA points/rebounds/assists)", () => {
    const slate = buildCrossGameSlate({ league: "nba", category: "NBA", games: [
      nbaGame("n1", 1000, "Lakers"), nbaGame("n2", 2000, "Celtics"), nbaGame("n3", 3000, "Heat"), nbaGame("n4", 4000, "Bucks"),
    ] })!;
    const statsUsed = new Set(slate.legs.map((l) => l.h2h.stat));
    const stems = slate.legs.map((l) => l.question);
    log(`§6.3 NBA slate: ${slate.legs.length} legs · stats=${JSON.stringify([...statsUsed])} · stems=${JSON.stringify(stems)}`);
    expect(slate.legs.length).toBeGreaterThanOrEqual(2);
    expect(statsUsed.size).toBeGreaterThanOrEqual(2); // rotated across stats, not one repeated
    expect(new Set(stems).size).toBe(stems.length); // no repeated question
    for (const leg of slate.legs) expect(detectBannedArchetype(leg.question, [leg.optionA, leg.optionB])).toBeNull();
  });

  it("pickTopPlayer takes the higher-value leader in the category", () => {
    const g = game("gX", 0, "Star", 20, "10", "Role", 3, "11");
    const top = pickTopPlayer(g, "goals")!;
    log(`top player of gX: ${top.name} (${top.seasonVal})`);
    expect(top.name).toBe("Star");
    expect(top.seasonVal).toBe(20);
  });

  it("returns null when a league has fewer than two usable games", () => {
    expect(buildCrossGameSlate({ league: "usa.1", category: "Soccer", games: [game("only", 0, "A", 1, "1", "B", 2, "2")] })).toBeNull();
    expect(buildCrossGameSlate({ league: "unknown-league", category: "X", games: [] })).toBeNull();
  });
});

describe("box-score grading", () => {
  // MLB batting box-score shape (verified against ESPN summary).
  const summary = {
    header: { competitions: [{ status: { type: { state: "post", completed: true } } }] },
    boxscore: {
      players: [
        {
          team: { displayName: "Cardinals" },
          statistics: [
            { type: "batting", labels: ["H-AB", "AB", "R", "H", "RBI", "HR", "BB", "K"], athletes: [
              { athlete: { id: "4941056", displayName: "JJ Wetherholt" }, stats: ["2-4", "4", "1", "2", "1", "0", "0", "1"] },
            ] },
          ],
        },
        {
          team: { displayName: "Blue Jays" },
          statistics: [
            { type: "batting", labels: ["H-AB", "AB", "R", "H", "RBI", "HR", "BB", "K"], athletes: [
              { athlete: { id: "30193", displayName: "George Springer" }, stats: ["1-3", "3", "0", "1", "0", "0", "1", "0"] },
            ] },
          ],
        },
      ],
    },
  };

  it("extractAthleteStat reads the labelled stat for an athlete", () => {
    const jj = extractAthleteStat(summary, "4941056", "H");
    const gs = extractAthleteStat(summary, "30193", "H");
    log(`box: JJ H=${jj} · Springer H=${gs} · completed=${summaryCompleted(summary)}`);
    expect(jj).toBe(2);
    expect(gs).toBe(1);
    expect(summaryCompleted(summary)).toBe(true);
    expect(extractAthleteStat(summary, "999999", "H")).toBeNull(); // athlete not in box score
  });

  it("resolveH2H: higher wins, tie/missing → review", () => {
    expect(resolveH2H(2, 1)).toBe("a");
    expect(resolveH2H(1, 2)).toBe("b");
    expect(resolveH2H(2, 2)).toBeNull(); // tie → review
    expect(resolveH2H(2, null)).toBeNull(); // missing → review
    log("resolveH2H: 2>1→a, 1<2→b, 2=2→null, missing→null");
  });
});
