/**
 * PROMPT PRIVACY (architect ruling) — the Locksmith gives GAME TIPS; NO player data reaches any model.
 * Asserts the chat + advisor system prompts carry zero identifying/financial fields, that the account
 * redirect is present (from the copy store, not a literal), and that neither route fetches user context.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSystemPrompt } from "./chat";
import { buildAdvisorSystemPrompt } from "./advisor";
import { LOCKSMITH_ACCOUNT_REDIRECT } from "@/lib/locksmith/copy";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// The exact labelled player-data lines the ruling removed. (Bare words like "KYC" or "win rate" stay
// legitimately — KYC is a general game rule, and the redirect instructs her NOT to reveal a win rate —
// so we assert the labelled per-player VALUES are gone, not the vocabulary.)
const PII_MARKERS = [
  /THE CURRENT PLAYER/i,
  /Username:/,
  /Coin balance:/i,
  /Cash balance:/i,
  /Total cash won/i,
  /Contests settled:/i,
];

describe("chat system prompt carries no player data", () => {
  const sys = buildSystemPrompt();
  it("buildSystemPrompt takes no arguments (no channel for PII)", () => {
    expect(buildSystemPrompt.length).toBe(0);
  });
  for (const re of PII_MARKERS) {
    it(`omits ${re}`, () => expect(re.test(sys)).toBe(false));
  }
  it("includes the account-redirect guidance from the copy store", () => {
    expect(sys).toContain(LOCKSMITH_ACCOUNT_REDIRECT);
    expect(sys).toMatch(/Wallet/);
    expect(sys).toMatch(/Board/);
  });
});

describe("advisor system prompt carries no player data", () => {
  const sys = buildAdvisorSystemPrompt("Sunday NBA", "NBA", [
    { question: "Who scores more?", optionA: "A", optionB: "B", probA: 55, probB: 45 },
  ]);
  it("no 'THE PLAYER' block or record", () => {
    expect(sys).not.toContain("THE PLAYER");
    expect(/win rate|contests settled|category performance/i.test(sys)).toBe(false);
  });
  it("still grounds advice in the slate probabilities", () => {
    expect(sys).toContain("Sunday NBA");
    expect(sys).toContain("55%");
  });
});

describe("neither AI route fetches per-user context anymore", () => {
  it("chat route does not import/call fetchUserChatContext", () => {
    expect(read("src/app/api/chat/route.ts").includes("fetchUserChatContext")).toBe(false);
  });
  it("advisor route does not import/call fetchUserChatContext", () => {
    expect(read("src/app/api/advisor/route.ts").includes("fetchUserChatContext")).toBe(false);
  });
});
