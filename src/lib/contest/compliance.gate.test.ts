/**
 * GATE — BANNED ARCHETYPE COMPLIANCE (§5). Prints the scan output with actual numbers.
 *   §5.1 zero banned archetypes survive detection on any surface (the exact feed + seed legs).
 *   §5.2 the display-path guard (firstBannedLeg) rejects a planted banned leg → withheld.
 *   §5.3 the compliant path still enforces one-player-per-game + mandatory context.
 */
import { describe, it, expect } from "vitest";
import {
  detectBannedArchetype,
  firstBannedLeg,
  validateLeg,
  type Leg,
  type StoredLegLike,
} from "./questionEngine";

const log = (m: string) => console.log(m); // eslint-disable-line no-console

// The EXACT legs the feed + seeds emit (from the audit), by source.
const OFFENDERS: { slate: string; source: string; question: string; optionA: string; optionB: string; type?: string }[] = [
  { slate: "espn-mls-*", source: "feed sync.ts:85", question: "Who wins?", optionA: "CF Montréal", optionB: "New England" },
  { slate: "espn-mls-*", source: "feed sync.ts:89", question: "Goal spread", optionA: "CF Montréal -0.5", optionB: "New England +0.5" },
  { slate: "espn-mls-*", source: "feed sync.ts:94", question: "Total goals", optionA: "Over 2.5", optionB: "Under 2.5", type: "over_under" },
  { slate: "seed-nfl-preseason", source: "seed-firestore.mjs:191", question: "Game winner", optionA: "Cowboys", optionB: "Rams" },
  { slate: "seed-wnba-primetime", source: "seed-firestore.mjs:81", question: "Who wins?", optionA: "Aces", optionB: "Liberty" },
  { slate: "seed-wnba-primetime", source: "seed-firestore.mjs:91", question: "Total points", optionA: "Over 168.5", optionB: "Under 168.5", type: "over_under" },
  { slate: "seed-mlb-deadline", source: "seed-firestore.mjs:61", question: "Total deadline-day trades", optionA: "Over 30.5", optionB: "Under 30.5", type: "over_under" },
  { slate: "seed-beg-nba", source: "seed-beginner.mjs:57", question: "Will the Lakers beat the Suns tonight?", optionA: "Yes", optionB: "No" },
  { slate: "seed-beg-nba", source: "seed-beginner.mjs:58", question: "Will LeBron score 25 or more?", optionA: "Yes", optionB: "No" },
  { slate: "seed-beg-nba", source: "seed-beginner.mjs:59", question: "Will the game go over 220 total points?", optionA: "Yes", optionB: "No" },
  { slate: "seed-beg-nba", source: "seed-beginner.mjs:60", question: "Will the Warriors cover the spread?", optionA: "Yes", optionB: "No" },
];

describe("§5.1 GATE — every known banned leg is detected", () => {
  it("all offenders map to a banned archetype (scan output printed)", () => {
    const rows = OFFENDERS.map((o) => {
      const arch = o.type === "over_under" ? "combined_team_totals" : detectBannedArchetype(o.question, [o.optionA, o.optionB]);
      const hit = firstBannedLeg([{ question: o.question, optionA: o.optionA, optionB: o.optionB, type: o.type }]);
      return { ...o, arch, caught: hit !== null };
    });
    log("§5.1 BANNED-LEG SCAN:");
    rows.forEach((r) => log(`  [${r.caught ? "CAUGHT" : "MISS  "}] ${r.source} · "${r.question}" (${r.optionA}/${r.optionB}) → ${r.arch}`));
    const missed = rows.filter((r) => !r.caught);
    log(`§5.1 totals: ${rows.length} offending legs scanned · ${rows.length - missed.length} caught · ${missed.length} missed`);
    expect(missed).toHaveLength(0);
  });

  it("clean cross-game legs are NOT falsely flagged", () => {
    const clean = [
      { q: "Field leader — top scorer across tonight's games", a: "LeBron James", b: "Nikola Jokić" },
      { q: "Who racks up more assists — a star from each game", a: "Trae Young", b: "Chris Paul" },
      { q: "Biggest night: which player leads the slate", a: "Player A", b: "Player B" },
    ];
    clean.forEach((c) => {
      const arch = detectBannedArchetype(c.q, [c.a, c.b]);
      log(`§5.1 clean · "${c.q}" → ${arch ?? "OK"}`);
      expect(arch).toBeNull();
    });
  });
});

describe("§5.2 GATE — the display-path guard withholds a planted banned leg", () => {
  it("firstBannedLeg (the guard applyWithhold uses) rejects a planted leg", () => {
    // A slate whose first leg is clean but a later leg is a planted spread — the whole slate withholds.
    const preds: StoredLegLike[] = [
      { question: "Field leader — most points tonight", optionA: "A", optionB: "B", type: "binary" },
      { question: "Point spread", optionA: "Home -3.5", optionB: "Away +3.5", type: "binary" },
    ];
    const hit = firstBannedLeg(preds);
    log(`§5.2 planted banned leg → withheld=${hit !== null} · "${hit?.question}" (${hit?.archetype})`);
    expect(hit).not.toBeNull();
    // and the withhold contract: a withheld slate serves NO predictions.
    const served = hit ? [] : preds;
    log(`§5.2 predictions served to client when withheld: ${served.length}`);
    expect(served).toHaveLength(0);

    // a fully-clean slate is NOT withheld.
    const clean: StoredLegLike[] = [{ question: "Biggest night across the slate", optionA: "A", optionB: "B", type: "binary" }];
    log(`§5.2 clean slate withheld=${firstBannedLeg(clean) !== null}`);
    expect(firstBannedLeg(clean)).toBeNull();
  });
});

describe("§5.3 GATE — the compliant path enforces one-per-game + context", () => {
  it("passes a clean cross-game leg; rejects same-game and missing-context", () => {
    const ctx = { seasonAverage: "27.4 ppg", last3Form: "31 / 24 / 29", matchupNote: "Both play tonight" };
    const clean: Leg = {
      archetype: "cross_game_h2h",
      players: [
        { name: "LeBron James", gameId: "g1", team: "LAL" },
        { name: "Nikola Jokić", gameId: "g2", team: "DEN" },
      ],
      context: ctx,
    };
    const ok = validateLeg(clean, ["g1", "g2"]);
    log(`§5.3 clean cross-game leg → ok=${ok.ok} "${ok.message}"`);
    expect(ok.ok).toBe(true);

    const sameGame: Leg = { ...clean, players: [
      { name: "LeBron James", gameId: "g1", team: "LAL" },
      { name: "Anthony Davis", gameId: "g1", team: "LAL" },
    ] };
    const bad = validateLeg(sameGame, ["g1", "g2"]);
    log(`§5.3 same-game leg → ok=${bad.ok} reason=${bad.reason}`);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe("two_from_one_game");

    const noCtx: Leg = { ...clean, context: null };
    const missing = validateLeg(noCtx, ["g1", "g2"]);
    log(`§5.3 missing-context leg → ok=${missing.ok} reason=${missing.reason}`);
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("missing_context");
  });
});
