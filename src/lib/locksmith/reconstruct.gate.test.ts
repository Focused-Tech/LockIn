/**
 * GATE (E) — the Locksmith reconstruction NEVER trusts the model. Structural guards reject a proposal
 * that isn't an approved archetype, carries banned free-text, or puts a number on an entertainment
 * subject — returning nothing rather than a broken approximation. Without an API key it is incompatible
 * (never a fabricated question).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyGuards } from "./reconstructGuards";

const log = (m: string) => console.log(m); // eslint-disable-line no-console
const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("applyGuards", () => {
  it("passes a clean sports proposal", () => {
    const r = applyGuards({ compatible: true, archetype: "cross_game_h2h", question: "Who racks up more assists tonight?" }, "sports");
    expect(r.compatible).toBe(true);
    expect(r.archetype).toBe("cross_game_h2h");
  });

  it("passes a clean entertainment proposal (nouns, no number)", () => {
    const r = applyGuards({ compatible: true, archetype: "field_leader", question: "Who leads the cast in screen time tonight?" }, "entertainment");
    expect(r.compatible).toBe(true);
  });

  for (const [label, out, domain] of [
    ["model says incompatible", { compatible: false, reason: "single game outcome" }, "sports"],
    ["not an approved archetype", { compatible: true, archetype: "who_wins", question: "Who wins tonight?" }, "sports"],
    ["banned free-text (over/under)", { compatible: true, archetype: "cross_game_h2h", question: "Take the over on total points?" }, "sports"],
    ["banned free-text (who wins)", { compatible: true, archetype: "cross_game_h2h", question: "Who wins the game tonight?" }, "sports"],
    ["number on an entertainment subject", { compatible: true, archetype: "milestone_count", question: "Who gets 3 confessionals?" }, "entertainment"],
    ["empty question", { compatible: true, archetype: "biggest_night", question: "" }, "sports"],
  ] as const) {
    it(`rejects: ${label}`, () => {
      const r = applyGuards(out as Parameters<typeof applyGuards>[0], domain);
      log(`reject "${label}" → compatible=${r.compatible} reason=${r.reason}`);
      expect(r.compatible).toBe(false);
      expect(r.question).toBeNull();
    });
  }
});

describe("reconstructSuggestion contract (source-asserted; server-only module not imported in tests)", () => {
  const src = read("src/lib/locksmith/reconstruct.ts");
  it("returns INCOMPATIBLE (never a fabricated question) when no API key is configured", () => {
    expect(src).toMatch(/if \(!process\.env\.ANTHROPIC_API_KEY\) return INCOMPATIBLE\("reconstruction unavailable"\)/);
  });
  it("runs moderation is upstream; the reconstruction output always passes applyGuards before returning", () => {
    expect(src).toMatch(/return applyGuards\(out, input\.domain\)/);
  });
  it("the submit action runs abuse moderation BEFORE reconstruction and never lets a follower publish", () => {
    const action = read("src/app/app/slate/[id]/suggest-actions.ts");
    expect(action.indexOf("moderateCreatorFields")).toBeLessThan(action.indexOf("reconstructSuggestion"));
    expect(action).toMatch(/status: "rejected_abuse"/);
    expect(action).toMatch(/status: "reconstructed"/);
  });
});
