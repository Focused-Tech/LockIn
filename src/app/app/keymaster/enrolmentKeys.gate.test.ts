/**
 * ENROLMENT KEYS — the two-code model's credential half. Contracts:
 *   · a key is tree-bound (issued with the keymaster's uid) and keymaster-gated;
 *   · redemption grants KEYHOLDER only + the upline, NEVER admin/keymaster;
 *   · single-use — a non-"unused" key is dead (burned in the redemption transaction);
 *   · an invalid key reveals nothing about any tree;
 *   · the referral code is the username (issued automatically — no separate credential);
 *   · revoke is limited to the issuing keymaster's own UNUSED keys.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const actions = read("src/app/app/keymaster/actions.ts");
const route = read("src/app/api/auth/key/route.ts");
const rules = read("firestore.rules");

describe("issuance — tree-bound + keymaster-gated", () => {
  it("generateEnrolmentKey requires a keymaster and binds the key to their uid", () => {
    expect(actions).toContain("generateEnrolmentKey");
    expect(actions).toContain("const km = await requireKeymaster()");
    expect(actions).toContain("keymasterUid: km,");
    expect(actions).toContain('status: "unused"');
  });
  it("revoke is own-tree-only and unused-only", () => {
    expect(actions).toContain('if (k.keymasterUid !== km) return { ok: false, error: "Not your key" }');
    expect(actions).toContain('if (k.status !== "unused") return { ok: false, error: "Only an unused key can be revoked" }');
  });
});

describe("redemption — keyholder only, single-use, leaks nothing", () => {
  it("grants keyholder + the upline, and NEVER admin/keymaster", () => {
    expect(route).toContain("keyholder: true, keymasterUid: k.keymasterUid"); // existing account attach
    expect(route).toContain("keyholder: true,"); // new account
    expect(route).toContain("keymasterUid: k.keymasterUid,"); // new account upline
    // never elevates the redeemer
    expect(/keymaster:\s*true/.test(route)).toBe(false);
    expect(/isAdmin:\s*true/.test(route)).toBe(false);
  });
  it("is single-use — a non-unused / expired key is dead, and the key is burned atomically", () => {
    expect(route).toContain('if (!k || k.status !== "unused") throw new Error("KEY_DEAD")');
    expect(route).toContain("k.expiresAt.toMillis() < Date.now()");
    expect(route).toContain('status: "redeemed", redeemedByUid: uid');
    expect(route).toContain("runTransaction"); // verify + burn in one txn
  });
  it("an invalid key reveals nothing about any tree", () => {
    expect(route).toContain('return NextResponse.json({ error: "That key can\'t be used." }, { status: 400 })');
    expect(route).toContain("if (found.empty) return dead()");
  });
  it("the referral code is the username (no separate credential is minted)", () => {
    // New accounts get a username (= referral code) and no keyholderUid stamp.
    expect(route).toContain("username: resolvedUsername");
    expect(route).toContain("keyholderUid: null");
  });
});

describe("keys are server-only in the rules", () => {
  it("the client SDK can neither read nor write enrolmentKeys", () => {
    const block = rules.slice(rules.indexOf("match /enrolmentKeys"), rules.indexOf("match /enrolmentKeys") + 160);
    expect(/allow read, write:\s*if false;/.test(block)).toBe(true);
  });
});
