/**
 * FIX-PASS contracts:
 *   A. FAB opens the SAME full-screen Locksmith surface (no compact drawer variant survives).
 *   C. Transcript bubbles are aligned by speaker (user right; Locksmith left with an avatar badge).
 *   F. Keymaster enrolment is server-guarded: keyholder-only, own-tree-only, never admin/keymaster.
 *   K. The beginner empty state has a CTA and "Tap a pick" is guarded to non-empty.
 *   I/J. No banned vocabulary on the beginner landing copy; no balances in the header.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("A — full-screen FAB parity, no compact variant", () => {
  it("both the tutorial and the FAB render LocksmithChat; the FAB is full-screen (inset-0)", () => {
    const tut = read("src/components/app/TutorialLauncher.tsx");
    const fab = read("src/components/ChatAssistant.tsx");
    expect(tut).toContain("<LocksmithChat");
    expect(fab).toContain("<LocksmithChat");
    expect(fab).toContain("fixed inset-0");
  });
  it("the compact drawer variant is GONE from the component and the FAB", () => {
    const chat = read("src/components/app/LocksmithChat.tsx");
    const fab = read("src/components/ChatAssistant.tsx");
    expect(/\bcompact\b/.test(chat)).toBe(false);
    expect(/\bcompact\b/.test(fab)).toBe(false);
  });
});

describe("C — speaker bubbles", () => {
  const chat = read("src/components/app/LocksmithChat.tsx");
  it("user messages align right; Locksmith messages align left with her avatar badge", () => {
    expect(chat).toContain('m.role === "user"');
    expect(chat).toContain("justify-end"); // user right
    expect(chat).toContain("LOCKSMITH_BADGE_SRC"); // her avatar beside the bubble (bottom-nav asset)
  });
  it("consecutive same-speaker messages don't repeat the avatar", () => {
    expect(chat).toContain("sameAsPrev");
    expect(chat).toContain('visibility: sameAsPrev ? "hidden" : "visible"');
  });
});

describe("F — keymaster enrolment guards (server-enforced)", () => {
  const actions = read("src/app/app/keymaster/actions.ts");
  it("enrol grants KEYHOLDER ONLY, into the caller's tree, never admin/keymaster", () => {
    expect(actions).toContain("await requireKeymaster()");
    expect(actions).toContain('if (t.isAdmin) return { ok: false, error: "Cannot enrol an admin" }');
    expect(actions).toContain('if (t.keymaster) return { ok: false, error: "Cannot enrol a keymaster" }');
    expect(actions).toContain("{ keyholder: true, keymasterUid: km }"); // keyholder-only, my tree
    // never grants admin or keymaster:true on the target
    expect(/keyholder: true, keymaster: true/.test(actions)).toBe(false);
    expect(/isAdmin: true/.test(actions)).toBe(false);
  });
  it("revoke is limited to the caller's own tree", () => {
    expect(actions).toContain('if (t.keymasterUid !== km) return { ok: false, error: "Not in your tree" }');
  });
});

describe("K — beginner empty-state CTA + guarded hint", () => {
  const bj = read("src/app/app/beginner/BeginnerJourney.tsx");
  it("'Tap a pick to try it' only renders when there are cards", () => {
    expect(bj).toContain("feed.cards.length > 0 && (");
    expect(bj).toContain("Tap a pick to try it");
  });
  it("the empty state offers a demo CTA", () => {
    expect(bj).toContain("Try a free demo");
    expect(bj).toContain('href="/app/slate/demo-nba"');
  });
});

describe("I/J — copy + header regression", () => {
  it("no 'coins, not odds' or 'not gambling/sports betting' on the beginner landing", () => {
    const disc = read("src/components/SkillGameDisclaimer.tsx");
    expect(/not gambling/i.test(disc)).toBe(false);
    expect(/sports betting/i.test(disc)).toBe(false);
    expect(read("src/app/app/beginner/BeginnerJourney.tsx").includes("coins, not odds")).toBe(false);
    expect(read("src/app/app/choose/JourneyPicker.tsx").includes("coins not odds")).toBe(false);
  });
  it("the header carries NO balances (no coin Pill)", () => {
    const nav = read("src/components/app/TopNav.tsx");
    expect(nav.includes("coinBalance")).toBe(false);
    expect(nav.includes("Pill")).toBe(false);
    expect(nav.includes("🪙")).toBe(false);
  });
});
