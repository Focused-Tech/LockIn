/**
 * §2 GATE — cross-game settlement against FIXTURE stats: each archetype resolves to the right winning
 * option, the §2.4 edge cases resolve to the stated conservative policy, the §2.5 bands assign across
 * a field, and one-player-per-game is enforced at entry (validateLeg — the exact check submitEntry runs).
 */
import { describe, it, expect } from "vitest";
import { fantasyPoints, resolveArchetype, type PlayerResult, type CrossGameLeg } from "./archetypes";
import { settleProSlate } from "./proSettle";
import { bandField, type BandInput } from "./bands";
import { validateLeg } from "./questionEngine";

const P = (composite: number, gameId: string, status: PlayerResult["status"] = "played"): PlayerResult => ({ composite, gameId, status });

describe("§2.2 composite (fantasy points)", () => {
  it("weights basketball stats into a single composite", () => {
    // 30 pts + 10 reb(×1.2) + 8 ast(×1.5) + 2 stl(×3) + 1 blk(×3) − 3 to(×1) + 4 threes(×0.5)
    const fp = fantasyPoints("basketball", { points: 30, rebounds: 10, assists: 8, steals: 2, blocks: 1, turnovers: 3, threes: 4 });
    expect(fp).toBe(30 + 12 + 12 + 6 + 3 - 3 + 2); // 62
  });
});

describe("§2.3 archetype resolution", () => {
  const by: Record<string, PlayerResult> = {
    luka: P(55, "gA"), tatum: P(48, "gA"), curry: P(40, "gB"), embiid: P(50, "gB"),
  };
  const opt = (k: string) => ({ key: k, playerNames: [k] });

  it("cross-game head-to-head → higher composite", () => {
    const leg: CrossGameLeg = { archetype: "cross_game_h2h", options: [opt("luka"), opt("curry")] };
    expect(resolveArchetype(leg, by).winningKey).toBe("luka");
  });
  it("field leader / biggest night → highest composite", () => {
    const opts = [opt("luka"), opt("tatum"), opt("curry"), opt("embiid")];
    expect(resolveArchetype({ archetype: "field_leader", options: opts }, by).winningKey).toBe("luka");
    expect(resolveArchetype({ archetype: "biggest_night", options: opts }, by).winningKey).toBe("luka");
  });
  it("split-squad duos → higher summed duo", () => {
    const leg: CrossGameLeg = { archetype: "split_squad_duos", options: [
      { key: "A", playerNames: ["luka", "curry"] }, { key: "B", playerNames: ["tatum", "embiid"] } ] };
    expect(resolveArchetype(leg, by).winningKey).toBe("B"); // A=luka+curry=95, B=tatum+embiid=98 → B8? -> B. check:
  });
  it("first-to-N → the unique player who reached N", () => {
    const leg: CrossGameLeg = { archetype: "first_to_n", bar: 52, options: [opt("luka"), opt("curry"), opt("embiid")] };
    expect(resolveArchetype(leg, by).winningKey).toBe("luka"); // only luka(55) ≥ 52
  });
  it("first-to-N with multiple reachers → void (no play-by-play order)", () => {
    const leg: CrossGameLeg = { archetype: "first_to_n", bar: 45, options: [opt("luka"), opt("embiid")] };
    expect(resolveArchetype(leg, by).voidLeg).toBe(true);
  });
  it("milestone count → the bucket the cleared-count lands in", () => {
    const leg: CrossGameLeg = { archetype: "milestone_count", bar: 50, countedPlayers: ["luka", "tatum", "curry", "embiid"],
      options: [{ key: "0-1", bucket: [0, 1] }, { key: "2-3", bucket: [2, 3] }, { key: "4", bucket: [4, 4] }] };
    // ≥50: luka(55), embiid(50) → 2 → bucket "2-3"
    expect(resolveArchetype(leg, by).winningKey).toBe("2-3");
  });
});

describe("§2.4 edge cases (conservative policy)", () => {
  const opt = (k: string) => ({ key: k, playerNames: [k] });
  it("DNP leaves <2 eligible → void", () => {
    const by = { a: P(40, "gA"), b: P(0, "gB", "dnp") };
    expect(resolveArchetype({ archetype: "cross_game_h2h", options: [opt("a"), opt("b")] }, by).voidLeg).toBe(true);
  });
  it("postponed game → void", () => {
    const by = { a: P(40, "gA"), b: P(30, "gB", "postponed"), c: P(20, "gC") };
    expect(resolveArchetype({ archetype: "field_leader", options: [opt("a"), opt("b"), opt("c")] }, by).reason).toBe("postponed");
  });
  it("tie for the top composite → void", () => {
    const by = { a: P(40, "gA"), b: P(40, "gB") };
    expect(resolveArchetype({ archetype: "cross_game_h2h", options: [opt("a"), opt("b")] }, by).voidLeg).toBe(true);
  });
});

describe("§2.5 bands", () => {
  it("HERO = 5 fastest perfect cards (25% net, 1000× cap); PREMIUM 10×; STANDARD 1.5×; rest none", () => {
    const field: BandInput[] = [];
    // 8 perfect cards with increasing lock time — only the 5 fastest are heroes.
    for (let i = 0; i < 8; i++) field.push({ id: `perfect${i}`, entryCostCents: 1000, perfect: true, score: 3, submittedAtMs: 1000 + i });
    // 300 non-perfect, descending score → a field big enough (308) that top-20% (62) fits hero(5)+
    // premium(45)+standard(12), so premium reaches its 45 cap.
    for (let i = 0; i < 300; i++) field.push({ id: `p${i}`, entryCostCents: 1000, perfect: false, score: 2 - i / 400, submittedAtMs: 5000 + i });
    const banded = bandField(field, 10_000_00); // $10,000 net
    const heroes = banded.filter((b) => b.band === "hero");
    expect(heroes.length).toBe(5);
    expect(heroes.map((h) => h.id).sort()).toEqual(["perfect0", "perfect1", "perfect2", "perfect3", "perfect4"]);
    // each hero: 25% of $10,000 / 5 = $500, capped at 1000×$10 = $10,000 → $500.
    expect(heroes[0]!.payoutCents).toBe(Math.floor((10_000_00 * 0.25) / 5));
    const premium = banded.filter((b) => b.band === "premium");
    expect(premium.length).toBe(45);
    expect(premium[0]!.payoutCents).toBe(10 * 1000); // 10× entry
    const standard = banded.filter((b) => b.band === "standard");
    expect(standard[0]!.payoutCents).toBe(Math.round(1.5 * 1000)); // 1.5× entry
    // paid = top 20% of the 308 field = 62 (hero 5 + premium 45 + standard 12).
    expect(banded.filter((b) => b.band !== "none").length).toBe(Math.ceil(308 * 0.2));
  });
});

describe("§2.3 entry-time one-player-per-game", () => {
  it("two players from the same game is rejected (the check submitEntry runs)", () => {
    const ctx = { seasonAverage: "-", last3Form: "-", matchupNote: "-" };
    const bad = validateLeg({ archetype: "cross_game_h2h", players: [{ name: "Luka", gameId: "gA", team: "" }, { name: "LeBron", gameId: "gA", team: "" }], context: ctx }, ["gA", "gB"]);
    expect(bad.reason).toBe("two_from_one_game");
    const ok = validateLeg({ archetype: "cross_game_h2h", players: [{ name: "Luka", gameId: "gA", team: "" }, { name: "Curry", gameId: "gB", team: "" }], context: ctx }, ["gA", "gB"]);
    expect(ok.ok).toBe(true);
  });
});

describe("§2 end-to-end settleProSlate", () => {
  it("resolves legs, scores entries, and bands a small field", () => {
    const by: Record<string, PlayerResult> = { luka: P(55, "gA"), curry: P(40, "gB") };
    const legs = [{ predictionId: "L1", leg: { archetype: "cross_game_h2h" as const, options: [{ key: "luka", playerNames: ["luka"] }, { key: "curry", playerNames: ["curry"] }] } }];
    const entries = [
      { id: "win", entryCostCents: 1000, submittedAtMs: 100, picks: { L1: "luka" } },
      { id: "lose", entryCostCents: 1000, submittedAtMs: 200, picks: { L1: "curry" } },
    ];
    const s = settleProSlate(legs, entries, by, 100_00);
    expect(s.results.L1!.winningKey).toBe("luka");
    const win = s.banded.find((b) => b.id === "win")!;
    const lose = s.banded.find((b) => b.id === "lose")!;
    expect(win.rank).toBe(1);
    expect(win.band).toBe("hero"); // perfect (1/1) + fastest
    expect(lose.band).toBe("none");
  });
});
