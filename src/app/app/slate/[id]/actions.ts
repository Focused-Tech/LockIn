"use server";

import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type EntryPick,
  type PredictionDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import { validateLeg, firstBannedLeg, type Archetype, type Leg } from "@/lib/contest/questionEngine";
import {
  FREE_ENTRY_COIN_COST,
  type EntryTier,
} from "@/lib/constants";
import { verifyForCash, PERJURY_ATTESTATION_TEXT, PERJURY_ATTESTATION_VERSION } from "@/lib/eligibility";
import { isSelfExcluded } from "@/server/data/responsiblePlay";

/**
 * §2 — record the player's penalty-of-perjury RESIDENCE ATTESTATION (the cash-entry gate). This is
 * NOT ID/KYC (that's deferred to the withdrawal threshold) — it's the digitally-accepted affirmation
 * the settled verification model requires alongside geo. Idempotent; affirms the registered state.
 */
export async function acceptCashAttestation(): Promise<{ ok: boolean; error?: string }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };
  const ref = adminDb().collection(COLLECTIONS.users).doc(uid);
  const snap = await ref.get();
  const user = snap.data() as UserDoc | undefined;
  if (!user) return { ok: false, error: "No profile" };
  if (!user.registeredState) return { ok: false, error: "Add your state before entering for cash." };
  await ref.update({
    cashAttestation: {
      affirmedState: user.registeredState,
      acceptedAt: FieldValue.serverTimestamp(),
      text: PERJURY_ATTESTATION_TEXT,
      version: PERJURY_ATTESTATION_VERSION,
    },
  });
  return { ok: true };
}

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

  // §2 — IP-derived state from Vercel's edge geo header (vendor-free), for the cash cross-check.
  const ipRegion = (await headers()).get("x-vercel-ip-country-region");

  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc(input.slateId);
  const slateSnap = await slateRef.get();
  if (!slateSnap.exists) return { ok: false, error: "Contest not found" };
  const slate = slateSnap.data() as SlateDoc;

  if (slate.status !== "live")
    return { ok: false, error: "This contest is no longer open" };
  if (slate.lockTime.toMillis() <= Date.now())
    return { ok: false, error: "This contest has locked" };

  // Picks must cover every prediction exactly once with a valid choice. §2.1 — a choice is one of the
  // prediction's option KEYS: binary → "a"/"b"; archetype → one of its proOptions keys.
  const predsSnap = await slateRef.collection(COLLECTIONS.predictions).get();
  const predById = new Map(predsSnap.docs.map((d) => [d.id, d.data() as PredictionDoc]));
  if (input.picks.length !== predById.size)
    return { ok: false, error: "Make a pick on every question" };
  const pickedIds = new Set<string>();
  for (const p of input.picks) {
    const pred = predById.get(p.predictionId);
    if (!pred) return { ok: false, error: "Invalid pick" };
    const validKeys = pred.predictionType === "archetype"
      ? (pred.proOptions ?? []).map((o) => o.key)
      : ["a", "b"];
    if (!validKeys.includes(p.choice)) return { ok: false, error: "Invalid pick" };
    pickedIds.add(p.predictionId);
  }
  if (pickedIds.size !== predById.size)
    return { ok: false, error: "Make a pick on every question" };

  // COMPLIANCE — reject entry on ANY slate carrying a banned archetype (team outcome, spread, total,
  // over/under, single-athlete threshold). Text-detected so free-text feed/seed/binary legs are caught
  // even though they never built a structured Leg. This is the entry-path half of the display withhold.
  const bannedLeg = firstBannedLeg(
    [...predById.values()].map((p) => ({ question: p.question, optionA: p.optionA, optionB: p.optionB, type: p.predictionType })),
  );
  if (bannedLeg)
    return { ok: false, error: "This contest is under review and can't be entered." };

  // §2.3 — re-enforce ONE-PLAYER-PER-GAME at ENTRY (not only at publish). Any archetype leg that
  // violates validateLeg (questionEngine.ts:75) rejects the whole entry.
  for (const pred of predById.values()) {
    if (pred.predictionType !== "archetype") continue;
    const playerGames = (pred as PredictionDoc & { playerGames?: Record<string, string> }).playerGames ?? {};
    const players = Object.entries(playerGames).map(([name, gameId]) => ({ name, gameId, team: "" }));
    const gameIds = [...new Set(players.map((pl) => pl.gameId))];
    const leg: Leg = {
      archetype: (pred.archetype ?? "cross_game_h2h") as Archetype,
      players,
      context: { seasonAverage: "-", last3Form: "-", matchupNote: "-" },
    };
    const verdict = validateLeg(leg, gameIds);
    if (!verdict.ok && verdict.reason === "two_from_one_game")
      return { ok: false, error: "This slate has an invalid question (one player per game) and can't be entered." };
  }

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
        // §2 — CASH GATE: IP-geo + registered-address cross-check + residence attestation. NO ID/KYC
        // precondition (that's a withdrawal-time check). Falls back to the registered state for IP when
        // the edge geo header is absent (local/dev), so it's the address self-check there.
        const att = user.cashAttestation;
        const verdict = verifyForCash({
          ipState: ipRegion || user.registeredState || null,
          addressState: user.registeredState ?? null,
          attestation: att ? { affirmedState: att.affirmedState, acceptedAt: 0, text: att.text, version: att.version } : null,
          dateOfBirth: user.dateOfBirth || null,
        });
        if (!verdict.ok) throw new Error(`CASH_${verdict.reason}`);
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
      case "CASH_no_attestation":
        return { ok: false, error: "Accept the residence attestation to enter for cash." };
      case "CASH_address_mismatch":
        return { ok: false, error: "Your location doesn't match your registered state — update your address to continue." };
      case "CASH_no_location":
        return { ok: false, error: "We couldn't confirm your location for cash play." };
      case "CASH_cash_blocked":
        return { ok: false, error: "Paid contests aren't available in your state" };
      case "CASH_no_dob":
        return { ok: false, error: "Add your date of birth to enter for cash." };
      case "CASH_under_min_age":
        return { ok: false, error: "You don't meet the minimum age for paid contests in your state." };
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
