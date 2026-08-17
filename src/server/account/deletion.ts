import "server-only";
import type { Firestore, Query } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import {
  ARRAY_MEMBERSHIPS,
  DELETED_USER_SENTINEL,
  actionableRules,
  type PersonalDataRule,
} from "./personalData";
import { evaluateBlockers, type Blocker, type BlockerInput } from "./blockers";

/**
 * ACCOUNT DELETION — the real one.
 *
 * Ordering matters and is not arbitrary:
 *   1. Re-check the blockers HERE. The client checked too, but a client check is a courtesy; this is
 *      the one that counts, and it runs inside the same request that does the deleting.
 *   2. Delete/anonymize the data.
 *   3. Delete the Firebase Auth user LAST. If step 2 dies halfway, the account still exists and the
 *      player can sign in and try again. Killing auth first would strand orphaned data behind a
 *      login nobody can perform.
 *
 * A `docId` locator is always executed as a DELETE even when the rule's strategy is "anonymize" —
 * you cannot anonymize a document whose id IS the user's uid. The counterparty's side of those
 * records (their own doc, their denormalized counts) is what survives.
 */

/** Firestore caps a write batch at 500 operations. */
const BATCH_LIMIT = 450;

export interface DeletionReceipt {
  uid: string;
  deletedDocs: number;
  anonymizedDocs: number;
  arrayMembershipsScrubbed: number;
  authUserDeleted: boolean;
  /** Per-collection tallies, for the report and for support if a player asks what happened. */
  perCollection: { collection: string; deleted: number; anonymized: number }[];
}

/** A blocked attempt — nothing was written. */
export class DeletionBlockedError extends Error {
  constructor(public readonly blockers: Blocker[]) {
    super("Account deletion is blocked");
    this.name = "DeletionBlockedError";
  }
}

/* ── Blocker gathering ─────────────────────────────────────────────────────────────────────────── */

/** Slate states in which a contest is still running (not finished, not called off). */
const OPEN_SLATE_STATES = ["draft", "live", "locked", "settling", "pending_review"];

/**
 * Count everything the blocker rules need. Reads only; safe to call from a render.
 */
export async function gatherBlockerInput(
  db: Firestore,
  uid: string,
  profile: Pick<UserDoc, "cashBalanceCents">,
): Promise<BlockerInput> {
  const [withdrawalSnap, depositSnap, entrySnap, hostedSnap] = await Promise.all([
    db
      .collection(COLLECTIONS.withdrawals)
      .where("userId", "==", uid)
      .where("status", "in", ["pending", "processing"])
      .get(),
    db
      .collection(COLLECTIONS.deposits)
      .where("userId", "==", uid)
      .where("status", "==", "pending")
      .get(),
    db.collectionGroup(COLLECTIONS.entries).where("userId", "==", uid).get(),
    db
      .collection(COLLECTIONS.slates)
      .where("creatorId", "==", uid)
      .where("status", "in", OPEN_SLATE_STATES)
      .get(),
  ]);

  // An entry is "open" when the contest above it hasn't finished. Look up each distinct parent slate
  // once rather than per entry.
  const parentIds = new Set<string>();
  for (const d of entrySnap.docs) {
    const slateId = d.ref.parent.parent?.id;
    if (slateId) parentIds.add(slateId);
  }
  let openEntries = 0;
  if (parentIds.size > 0) {
    const slates = await db.getAll(
      ...[...parentIds].map((id) => db.collection(COLLECTIONS.slates).doc(id)),
    );
    const openIds = new Set(
      slates
        .filter((s) => OPEN_SLATE_STATES.includes((s.data()?.status as string) ?? ""))
        .map((s) => s.id),
    );
    openEntries = entrySnap.docs.filter((d) => {
      const pid = d.ref.parent.parent?.id;
      return pid ? openIds.has(pid) : false;
    }).length;
  }

  return {
    cashBalanceCents: profile.cashBalanceCents ?? 0,
    pendingWithdrawals: withdrawalSnap.size,
    pendingDeposits: depositSnap.size,
    openEntries,
    openHostedContests: hostedSnap.size,
  };
}

/** Read-only: what (if anything) is stopping this account from being deleted right now. */
export async function checkDeletionBlockers(uid: string): Promise<Blocker[]> {
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) return [];
  const profile = snap.data() as UserDoc;
  return evaluateBlockers(await gatherBlockerInput(db, uid, profile));
}

/* ── Execution helpers ─────────────────────────────────────────────────────────────────────────── */

/** Delete every doc a query matches, in chunks. Returns how many went. */
async function deleteQuery(db: Firestore, query: Query): Promise<number> {
  const snap = await query.get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
    n += Math.min(BATCH_LIMIT, snap.docs.length - i);
  }
  return n;
}

/** Overwrite one field with the tombstone on every doc a query matches. Returns how many. */
async function anonymizeQuery(db: Firestore, query: Query, field: string): Promise<number> {
  const snap = await query.get();
  let n = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { [field]: DELETED_USER_SENTINEL });
    }
    await batch.commit();
    n += Math.min(BATCH_LIMIT, snap.docs.length - i);
  }
  return n;
}

/** Build the query for a field locator — top-level collection or collectionGroup. */
function queryFor(db: Firestore, rule: PersonalDataRule, field: string, group: boolean, uid: string): Query {
  const name = COLLECTIONS[rule.collection];
  const base = group ? db.collectionGroup(name) : db.collection(name);
  return base.where(field, "==", uid);
}

/* ── The deletion itself ───────────────────────────────────────────────────────────────────────── */

/**
 * The data half of the deletion, with the Firestore handle injected. Separated from
 * {@link deleteAccount} so it can be executed against a fake store in tests — the claim "it actually
 * deletes" is only worth making if something has run it.
 *
 * Assumes the blocker check has already passed; {@link deleteAccount} is the guarded entry point.
 */
export async function deleteAccountData(
  db: Firestore,
  uid: string,
  profile: Pick<UserDoc, "username">,
): Promise<Omit<DeletionReceipt, "uid" | "authUserDeleted">> {
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const tally = new Map<string, { deleted: number; anonymized: number }>();
  const bump = (c: string, k: "deleted" | "anonymized", n: number) => {
    const row = tally.get(c) ?? { deleted: 0, anonymized: 0 };
    row[k] += n;
    tally.set(c, row);
    return n;
  };

  let deletedDocs = 0;
  let anonymizedDocs = 0;

  // (2) Walk the map. `users` is handled separately at the end (recursive, with its subcollections),
  // and subcollection rules ride along with it.
  for (const rule of actionableRules()) {
    if (rule.collection === "users") continue;
    const name = COLLECTIONS[rule.collection];

    for (const loc of rule.locators) {
      if (loc.kind === "subcollection") continue; // deleted with the parent user doc

      if (loc.kind === "docId") {
        // An id cannot be anonymized — this doc IS the user. It goes, whatever the rule's strategy.
        const ref = db.collection(name).doc(uid);
        if ((await ref.get()).exists) {
          await ref.delete();
          deletedDocs += bump(name, "deleted", 1);
        }
        continue;
      }

      if (loc.kind === "docIdOther") {
        // usernames/{lower}. Only release it if it actually points at this account.
        const handle = (profile.username ?? "").toLowerCase();
        if (!handle) continue;
        const ref = db.collection(name).doc(handle);
        const snap = await ref.get();
        if (snap.exists && (snap.data() as { uid?: string })?.uid === uid) {
          await ref.delete();
          deletedDocs += bump(name, "deleted", 1);
        }
        continue;
      }

      if (loc.kind === "field") {
        const q = queryFor(db, rule, loc.field, loc.group === true, uid);
        if (rule.strategy === "delete") {
          deletedDocs += bump(name, "deleted", await deleteQuery(db, q));
        } else {
          anonymizedDocs += bump(name, "anonymized", await anonymizeQuery(db, q, loc.field));
        }
      }
    }
  }

  // (3) Scrub the uid out of other people's arrays.
  let arrayMembershipsScrubbed = 0;
  for (const m of ARRAY_MEMBERSHIPS) {
    const name = COLLECTIONS[m.collection];
    const snap = await db.collection(name).where(m.field, "array-contains", uid).get();
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
        batch.update(d.ref, { [m.field]: FieldValue.arrayRemove(uid) });
      }
      await batch.commit();
    }
    arrayMembershipsScrubbed += snap.size;
  }

  // (4) The profile and everything beneath it (categoryStats, triviaSeen, tutorials,
  //     championshipCards, creatorSignatures).
  await db.recursiveDelete(userRef);
  deletedDocs += bump(COLLECTIONS.users, "deleted", 1);

  return {
    deletedDocs,
    anonymizedDocs,
    arrayMembershipsScrubbed,
    perCollection: [...tally.entries()].map(([collection, v]) => ({ collection, ...v })),
  };
}

/**
 * Delete the account. Throws {@link DeletionBlockedError} if a blocker is live — nothing is written
 * in that case.
 */
export async function deleteAccount(uid: string): Promise<DeletionReceipt> {
  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new Error("NO_SUCH_USER");
  const profile = userSnap.data() as UserDoc;

  // (1) The check that counts, in the same request as the writes.
  const blockers = evaluateBlockers(await gatherBlockerInput(db, uid, profile));
  if (blockers.length > 0) throw new DeletionBlockedError(blockers);

  // (2)-(4) The data.
  const receipt = await deleteAccountData(db, uid, profile);

  // (5) Auth LAST — see the header note on ordering.
  let authUserDeleted = false;
  try {
    await adminAuth().deleteUser(uid);
    authUserDeleted = true;
  } catch (err) {
    // Already gone counts as success. Anything else is logged, but the data is already deleted, so
    // we do not fail the whole call and leave the player believing nothing happened.
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") authUserDeleted = true;
    else console.error("[account] auth deleteUser failed after data deletion", uid, err);
  }

  return { uid, authUserDeleted, ...receipt };
}
