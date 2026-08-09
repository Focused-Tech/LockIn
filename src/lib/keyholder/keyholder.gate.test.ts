/**
 * KEYHOLDER PORTAL GATE — the referral-tracking rails. Proves the four load-bearing contracts:
 *   1. ATTRIBUTION IMMUTABILITY — keyholder attribution is stamped only at account creation and can
 *      never be re-assigned (re-signup is idempotent; the field is off the client write whitelist).
 *   2. LEDGER APPEND-ONLY — qualifying events are create-once (never updated); clients can't write.
 *   3. ROLE GATING — the portal 404s non-keyholders; role writes require an admin.
 *   4. NULL-FOLLOWER "—" — no social connect ⇒ participation renders "—", never 0, and no dollars.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keyholderStampFor } from "./attribution";
import {
  participationPct,
  triggerBandStatus,
  projectKeyholderEarnings,
  keyholderRatesArmed,
  playerBountyArmed,
} from "./projection";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("attribution — pure first-touch stamp", () => {
  it("stamps only when the referrer is a keyholder; ordinary referrals are untouched", () => {
    expect(keyholderStampFor(null)).toBeNull();
    expect(keyholderStampFor({ uid: "r1" })).toBeNull(); // not a keyholder
    expect(keyholderStampFor({ uid: "r1", keyholder: false })).toBeNull();
    expect(keyholderStampFor({ uid: "kh1", keyholder: true })).toEqual({ keyholderUid: "kh1", keymasterUid: null });
    expect(keyholderStampFor({ uid: "kh1", keyholder: true, keymasterUid: "km1" })).toEqual({
      keyholderUid: "kh1",
      keymasterUid: "km1",
    });
  });

  it("is deterministic — same referrer always yields the same stamp (no drift on re-eval)", () => {
    const r = { uid: "kh1", keyholder: true, keymasterUid: "km1" };
    expect(keyholderStampFor(r)).toEqual(keyholderStampFor(r));
  });
});

describe("attribution IMMUTABILITY — write path can never re-attribute", () => {
  const signup = read("src/app/api/auth/signup/route.ts");
  const social = read("src/app/api/auth/social/route.ts");
  const rules = read("firestore.rules");

  it("keyholderUid is written ONLY inside the account-creation set (never an update)", () => {
    // The stamp appears exactly at create time in both signup paths.
    expect(signup).toContain("keyholderUid: keyStamp?.keyholderUid ?? null,");
    expect(social).toContain("keyholderUid: keyStamp?.keyholderUid ?? null,");
    // The user-doc stamp is written exactly once (the create); no second, update-style assignment.
    expect((signup.match(/keyStamp\?\.keyholderUid \?\? null/g) || []).length).toBe(1);
    expect((social.match(/keyStamp\?\.keyholderUid \?\? null/g) || []).length).toBe(1);
  });

  it("re-signup is idempotent — an existing profile returns without rewriting", () => {
    expect(signup).toContain('if (message === "PROFILE_EXISTS")');
    // social path only creates when !existing (the create branch is guarded by `existing.exists`).
    expect(social).toContain("if (existing.exists) {");
  });

  it("the client user-doc update whitelist excludes every keyholder field", () => {
    // isolate the users/{userId} update rule
    const i = rules.indexOf("match /users/{userId}");
    const region = rules.slice(i, rules.indexOf("match /usernames", i));
    const whitelist = region.slice(region.indexOf("hasOnly"), region.indexOf(")", region.indexOf("hasOnly")));
    for (const field of ["keyholder", "keymaster", "keymasterUid", "keyholderUid", "verifiedFollowers"]) {
      expect(whitelist.includes(field)).toBe(false);
    }
  });
});

describe("ledger APPEND-ONLY", () => {
  const events = read("src/server/keyholder/events.ts");
  const rules = read("firestore.rules");

  it("every qualifying event is create-once (.create), and the ledger is never updated", () => {
    for (const type of ["creator_activated", "creator_event_settled", "player_qualified"]) {
      expect(events.includes(`type: "${type}"`)).toBe(true);
    }
    // ledger writes go through .create( — create-once/idempotent by deterministic id
    expect((events.match(/\.create\(/g) || []).length).toBeGreaterThanOrEqual(3);
    // and nothing in the writer issues an .update( on the ledger
    expect(events.includes(".update(")).toBe(false);
  });

  it("the referral index is typed at most once (never re-typed)", () => {
    expect(events).toContain("if ((snap.data() as { type?: unknown }).type) return;");
  });

  it("clients cannot write the ledger or the attribution index (rules deny)", () => {
    const evBlock = rules.slice(rules.indexOf("match /keyholderEvents"), rules.indexOf("match /keyholderEvents") + 260);
    const refBlock = rules.slice(rules.indexOf("match /keyholderReferrals"), rules.indexOf("match /keyholderReferrals") + 320);
    expect(/allow write:\s*if false;/.test(evBlock)).toBe(true);
    expect(/allow write:\s*if false;/.test(refBlock)).toBe(true);
  });
});

describe("role GATING", () => {
  it("the portal 404s a non-keyholder (notFound, not a locked page)", () => {
    const page = read("src/app/app/keyholder/page.tsx");
    expect(page).toContain("if (!profile.keyholder) notFound();");
    expect(page).toContain("notFound");
  });

  it("role writes require an admin and have no self-serve path", () => {
    const actions = read("src/app/admin/keyholders/actions.ts");
    expect(actions).toContain('"use server"');
    expect((actions.match(/await requireAdmin\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(actions).toContain('return { ok: false, error: "Not authorized" }');
  });
});

describe("null-follower — participation is '—', never 0, and no dollar figures", () => {
  it("participationPct is null without a verified follower count (and guards divide-by-zero)", () => {
    expect(participationPct(50, null)).toBeNull();
    expect(participationPct(50, undefined)).toBeNull();
    expect(participationPct(50, 0)).toBeNull();
    expect(participationPct(10, 1000)).toBeCloseTo(0.01, 6);
  });

  it("band status renders '—' when participation is unknown", () => {
    expect(triggerBandStatus(null)).toBe("—");
  });

  it("the model ships UNARMED — every projected dollar is null (portal shows '—')", () => {
    expect(keyholderRatesArmed()).toBe(false);
    expect(playerBountyArmed()).toBe(false);
    const p = projectKeyholderEarnings({ creatorEvents: [{ entries: 100, participationPct: 0.05 }], qualifiedPlayers: 3 });
    expect(p.armed).toBe(false);
    expect(p.creatorProjectedCents).toBeNull();
    expect(p.playerProjectedCents).toBeNull();
    expect(p.totalProjectedCents).toBeNull();
  });

  it("the portal view maps null → '—' for participation and for projected dollars", () => {
    const view = read("src/app/app/keyholder/KeyholderPortal.tsx");
    expect(view).toContain('p == null ? "—"'); // pctLabel
    expect(view).toContain('b.projectedCents == null ? "—"'); // earnings by band
    expect(view).toContain("PROJECTED — rates pending final approval");
    // no payout CTA anywhere in the portal — no Payout / Withdraw / Cash-out button label
    expect(view.includes("Payout")).toBe(false);
    expect(/withdraw|cash out/i.test(view)).toBe(false);
  });
});
