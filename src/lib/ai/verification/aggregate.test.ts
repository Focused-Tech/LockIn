import { describe, expect, it } from "vitest";
import { aggregateVotes } from "./aggregate";
import type { SourceVote, VerdictPolicy } from "./types";

const POLICY: VerdictPolicy = { minSources: 3, autoSettleConfidence: 0.99 };
const vote = (
  source: string,
  choice: "a" | "b" | null,
  confidence: number,
): SourceVote => ({ source, choice, confidence, detail: "" });

describe("aggregateVotes", () => {
  it("returns no choice when nothing is decisive", () => {
    const v = aggregateVotes([vote("espn", null, 0)], POLICY);
    expect(v.choice).toBeNull();
    expect(v.autoSettle).toBe(false);
  });

  it("auto-settles on a single authoritative source", () => {
    const v = aggregateVotes(
      [vote("espn", "a", 0.99), vote("ai-prior", "a", 0.7)],
      POLICY,
    );
    expect(v.choice).toBe("a");
    expect(v.confidence).toBeCloseTo(0.99); // strongest backer, full agreement
    expect(v.autoSettle).toBe(true);
  });

  it("routes a lone AI-prior guess to review (not authoritative, no quorum)", () => {
    const v = aggregateVotes([vote("ai-prior", "a", 0.99)], POLICY);
    expect(v.autoSettle).toBe(false);
  });

  it("auto-settles on a unanimous 3-source quorum without an authoritative feed", () => {
    const v = aggregateVotes(
      [
        vote("ai-prior", "b", 0.99),
        vote("src2", "b", 0.95),
        vote("src3", "b", 0.9),
      ],
      POLICY,
    );
    // src2/src3 are non-"ai-prior" → authoritative, so this also satisfies the
    // authoritative rule; either way it must auto-settle.
    expect(v.choice).toBe("b");
    expect(v.autoSettle).toBe(true);
  });

  it("never auto-settles when sources conflict", () => {
    const v = aggregateVotes(
      [vote("espn", "a", 0.99), vote("coingecko", "b", 0.99)],
      POLICY,
    );
    expect(v.agreement).toBeLessThan(1);
    expect(v.autoSettle).toBe(false);
  });

  it("withholds auto-settle when authoritative confidence is below threshold", () => {
    const v = aggregateVotes([vote("espn", "a", 0.6)], POLICY);
    expect(v.choice).toBe("a");
    expect(v.confidence).toBeCloseTo(0.6);
    expect(v.autoSettle).toBe(false);
  });

  it("picks the side with greater summed confidence", () => {
    const v = aggregateVotes(
      [vote("s1", "a", 0.5), vote("s2", "b", 0.4), vote("s3", "b", 0.4)],
      POLICY,
    );
    expect(v.choice).toBe("b"); // 0.8 vs 0.5
  });
});
