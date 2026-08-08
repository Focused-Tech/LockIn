import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type KeyholderReferralType } from "@/lib/firebase/types";
import { participationPct } from "@/lib/keyholder/projection";
import { PLAYER_QUALIFY_ENTRIES_CENTS } from "@/lib/contest/architectSet";

/**
 * KEYHOLDER QUALIFYING-EVENT LEDGER writers — APPEND-ONLY, NO money moves.
 *
 * Each event is written via `.create()` on a DETERMINISTIC doc id, so re-settlement (settleSlate is
 * idempotent) never duplicates and nothing is ever updated in place. These records are the tracking
 * substrate the portal projects earnings from; there is no payout side effect anywhere in here.
 */

/** Stamp the referral index with what the account became — once. */
async function typeReferral(
  db: Firestore,
  referredUid: string,
  type: KeyholderReferralType,
): Promise<void> {
  const ref = db.collection(COLLECTIONS.keyholderReferrals).doc(referredUid);
  const snap = await ref.get();
  if (!snap.exists) return; // not a keyholder referral
  if ((snap.data() as { type?: unknown }).type) return; // already typed — never re-type
  await ref.set({ type, typedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export interface CreatorSettlementInput {
  slateId: string;
  creatorUid: string;
  keyholderUid: string;
  keymasterUid: string | null;
  /** Verified follower count of the creator, or null when no social connect. */
  verifiedFollowers: number | null;
  /** Non-refunded PAID entries on this slate. */
  paidEntries: number;
  /** Gross host fees on this slate (server-side projection input; never shown to a keyholder). */
  grossHostFeesCents: number;
}

/**
 * Record a settled slate by a keyholder-referred creator:
 *   · first settled slate WITH paid entries → `creator_activated` (slate id, entries)
 *   · every subsequent settled slate        → `creator_event_settled` (entries, gross host fees,
 *                                              participation_pct = entries / verified followers)
 * A slate with no paid entries records nothing.
 */
export async function recordCreatorSettlement(
  db: Firestore,
  input: CreatorSettlementInput,
): Promise<void> {
  if (input.paidEntries <= 0) return;

  const events = db.collection(COLLECTIONS.keyholderEvents);
  const activatedRef = events.doc(`creator_activated_${input.creatorUid}`);
  const activatedSnap = await activatedRef.get();

  if (!activatedSnap.exists) {
    // First-ever paid settlement for this creator → activation. (Not also a "subsequent" event.)
    try {
      await activatedRef.create({
        type: "creator_activated",
        keyholderUid: input.keyholderUid,
        keymasterUid: input.keymasterUid,
        referredUid: input.creatorUid,
        slateId: input.slateId,
        entries: input.paidEntries,
        grossHostFeesCents: null,
        participationPct: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      /* raced — already created */
    }
    await typeReferral(db, input.creatorUid, "creator");
    return;
  }

  // Subsequent settled slate.
  const pct = participationPct(input.paidEntries, input.verifiedFollowers);
  const settledRef = events.doc(`creator_event_settled_${input.slateId}`);
  try {
    await settledRef.create({
      type: "creator_event_settled",
      keyholderUid: input.keyholderUid,
      keymasterUid: input.keymasterUid,
      referredUid: input.creatorUid,
      slateId: input.slateId,
      entries: input.paidEntries,
      grossHostFeesCents: input.grossHostFeesCents,
      participationPct: pct,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* already recorded */
  }
}

/**
 * Qualify a keyholder-referred PLAYER once they have BOTH deposited AND reached
 * PLAYER_QUALIFY_ENTRIES_CENTS in settled entries. Idempotent (deterministic doc id). Inert while
 * the threshold is an unset placeholder — returns before any read, so settlement pays no cost until
 * the architect arms it.
 */
export async function maybeQualifyPlayer(
  db: Firestore,
  referredUid: string,
  keyholderUid: string,
  keymasterUid: string | null,
): Promise<void> {
  if (PLAYER_QUALIFY_ENTRIES_CENTS == null) return; // unarmed

  const events = db.collection(COLLECTIONS.keyholderEvents);
  const qualRef = events.doc(`player_qualified_${referredUid}`);
  if ((await qualRef.get()).exists) return; // already qualified

  // Must have at least one successful deposit.
  const dep = await db
    .collection(COLLECTIONS.deposits)
    .where("userId", "==", referredUid)
    .where("status", "==", "succeeded")
    .limit(1)
    .get();
  if (dep.empty) return;

  // Sum settled PAID entry cost (rank is set only at settlement) across all of the player's entries.
  const entriesSnap = await db
    .collectionGroup(COLLECTIONS.entries)
    .where("userId", "==", referredUid)
    .get();
  let settledCents = 0;
  for (const d of entriesSnap.docs) {
    const e = d.data() as { isPaid?: boolean; rank?: number | null; refunded?: boolean; entryTier?: number; hostingFeeCents?: number };
    if (e.isPaid && e.rank != null && !e.refunded) {
      settledCents += (e.entryTier ?? 0) * 100 + (e.hostingFeeCents ?? 0);
    }
  }
  if (settledCents < PLAYER_QUALIFY_ENTRIES_CENTS) return;

  try {
    await qualRef.create({
      type: "player_qualified",
      keyholderUid,
      keymasterUid,
      referredUid,
      slateId: null,
      entries: null,
      grossHostFeesCents: null,
      participationPct: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    /* raced */
  }
  await typeReferral(db, referredUid, "player");
}
