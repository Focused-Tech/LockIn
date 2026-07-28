"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type EntryPick,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import {
  FREE_ENTRY_COIN_COST,
  type EntryTier,
} from "@/lib/constants";
import { canPlayerEnterCash } from "@/lib/eligibility";
import { isSelfExcluded } from "@/server/data/responsiblePlay";

export type SubmitEntryInput = {
  slateId: string;
  tier: EntryTier;
  free: boolean;
  picks: EntryPick[];
};

export type SubmitEntryResult =
  | { ok: true; entryId: string }
  | { ok: false; error: string };

/**
 * Submit a pick card as a contest entry. Enforces: contest is live + unlocked,
 * picks cover every prediction once, one entry per user (entry doc id = uid),
 * sufficient balance, and — for paid entries — KYC + geo eligibility. Balance
 * debit, slate entry-count bump, and the entry write happen atomically.
 */
export async function submitEntry(
  input: SubmitEntryInput,
): Promise<SubmitEntryResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc(input.slateId);
  const slateSnap = await slateRef.get();
  if (!slateSnap.exists) return { ok: false, error: "Contest not found" };
  const slate = slateSnap.data() as SlateDoc;

  if (slate.status !== "live")
    return { ok: false, error: "This contest is no longer open" };
  if (slate.lockTime.toMillis() <= Date.now())
    return { ok: false, error: "This contest has locked" };

  // Picks must cover every prediction exactly once with a valid choice.
  const predsSnap = await slateRef.collection(COLLECTIONS.predictions).get();
  const predIds = new Set(predsSnap.docs.map((d) => d.id));
  if (input.picks.length !== predIds.size)
    return { ok: false, error: "Make a pick on every question" };
  const pickedIds = new Set<string>();
  for (const p of input.picks) {
    if (!predIds.has(p.predictionId) || (p.choice !== "a" && p.choice !== "b"))
      return { ok: false, error: "Invalid pick" };
    pickedIds.add(p.predictionId);
  }
  if (pickedIds.size !== predIds.size)
    return { ok: false, error: "Make a pick on every question" };

  const tierConfig = slate.entryTiers.find((t) => t.tier === input.tier);
  if (!input.free && !tierConfig)
    return { ok: false, error: "That entry tier isn't offered" };
  const hostingFeeCents = input.free ? 0 : (tierConfig?.hostingFeeCents ?? 0);
  const entryCostCents = input.tier * 100 + hostingFeeCents;

  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const entryRef = slateRef.collection(COLLECTIONS.entries).doc(uid);

  try {
    await db.runTransaction(async (tx) => {
      const [entrySnap, userSnap, freshSlateSnap] = await Promise.all([
        tx.get(entryRef),
        tx.get(userRef),
        tx.get(slateRef),
      ]);

      if (entrySnap.exists) throw new Error("ALREADY_ENTERED");
      const user = userSnap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");
      if (isSelfExcluded(user)) throw new Error("EXCLUDED");
      const fresh = freshSlateSnap.data() as SlateDoc | undefined;
      if (
        !fresh ||
        fresh.status !== "live" ||
        fresh.lockTime.toMillis() <= Date.now()
      )
        throw new Error("CLOSED");
      if (fresh.maxEntries != null && (fresh.entryCount ?? 0) >= fresh.maxEntries)
        throw new Error("FULL");

      if (input.free) {
        if (user.coinBalance < FREE_ENTRY_COIN_COST) throw new Error("LOW_COINS");
        tx.update(userRef, {
          coinBalance: user.coinBalance - FREE_ENTRY_COIN_COST,
        });
      } else {
        if (user.kycStatus !== "verified") throw new Error("NEEDS_KYC");
        // SLICE 1.4 — player-side cash gate through the ONE resolver (fail-closed on unknown state).
        if (!canPlayerEnterCash(user.registeredState)) throw new Error("GEO_BLOCKED");
        if (user.cashBalanceCents < entryCostCents) throw new Error("LOW_CASH");
        tx.update(userRef, {
          cashBalanceCents: user.cashBalanceCents - entryCostCents,
        });
      }

      tx.update(slateRef, { entryCount: (fresh.entryCount ?? 0) + 1 });
      tx.set(entryRef, {
        userId: uid,
        entryTier: input.tier,
        hostingFeeCents,
        isPaid: !input.free,
        coinCost: input.free ? FREE_ENTRY_COIN_COST : null,
        picks: input.picks,
        score: null,
        rank: null,
        payoutCents: null,
        payoutCoins: null,
        refunded: false,
        submittedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    switch (m) {
      case "ALREADY_ENTERED":
        return { ok: false, error: "You've already entered this contest" };
      case "LOW_COINS":
        return { ok: false, error: "Not enough coins for a free entry" };
      case "NEEDS_KYC":
        return {
          ok: false,
          error: "Verify your identity to enter paid contests",
        };
      case "GEO_BLOCKED":
        return {
          ok: false,
          error: "Paid contests aren't available in your state",
        };
      case "LOW_CASH":
        return { ok: false, error: "Add funds to enter this paid contest" };
      case "CLOSED":
        return { ok: false, error: "This contest just closed" };
      case "FULL":
        return { ok: false, error: "This Card Rush is full" };
      case "EXCLUDED":
        return {
          ok: false,
          error: "Your account is self-excluded. Play is paused.",
        };
      default:
        return { ok: false, error: "Could not submit your entry" };
    }
  }

  return { ok: true, entryId: uid };
}
