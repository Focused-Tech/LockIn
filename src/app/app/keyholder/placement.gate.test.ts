/**
 * PLACEMENT MODEL — keyholders can only REQUEST; keymasters approve. Contracts:
 *   · requestPlacement is keyholder-gated, resolves a keymaster by code, and blocks an
 *     already-placed keyholder (placement is once);
 *   · approve/decline are keymaster-gated and limited to requests addressed to THAT keymaster;
 *   · approval grants keyholder + upline only, never admin/keymaster, never poaches another tree;
 *   · keyholders cannot make keys (generateEnrolmentKey is keymaster-gated).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const khActions = read("src/app/app/keyholder/actions.ts");
const kmActions = read("src/app/app/keymaster/actions.ts");

describe("keyholder request path", () => {
  it("requestPlacement is keyholder-gated and blocks the already-placed", () => {
    expect(khActions).toContain('if (!me || me.keyholder !== true) return { ok: false, error: "Only keyholders can request placement" }');
    expect(khActions).toContain('if (me.keymasterUid) return { ok: false, error: "You\'re already in a keymaster\'s tree" }');
    expect(khActions).toContain('if (!km || km.keymaster !== true)'); // target must be a keymaster
  });
});

describe("keymaster approves; guards hold", () => {
  it("approve is limited to requests addressed to the caller and grants keyholder + upline only", () => {
    expect(kmActions).toContain("req.keymasterUid !== km");
    expect(kmActions).toContain('if (u.isAdmin || u.keymaster) return { ok: false, error: "Cannot place that account" }');
    expect(kmActions).toContain("Already in another keymaster's tree");
    expect(kmActions).toContain("{ keyholder: true, keymasterUid: km }");
  });
  it("key generation stays keymaster-only (keyholders cannot make keys)", () => {
    // generateEnrolmentKey requires a keymaster; there is no keyholder-side key generator.
    const gen = kmActions.slice(kmActions.indexOf("generateEnrolmentKey"), kmActions.indexOf("generateEnrolmentKey") + 260);
    expect(gen).toContain("await requireKeymaster()");
    expect(khActions.includes("generateEnrolmentKey")).toBe(false);
  });
});
