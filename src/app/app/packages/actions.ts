"use server";

import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type PickPackageDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import { moderateCreatorFields, firstModerationError } from "@/lib/moderation/creatorContent";
import {
  PACKAGE_MAX_PRICE_CENTS,
  PACKAGE_MIN_PRICE_CENTS,
  PACKAGE_SPLIT,
} from "@/lib/constants";
import { isSelfExcluded } from "@/server/data/responsiblePlay";

// ── Create ──────────────────────────────────────────────────────────────────
const pickSchema = z.object({
  predictionId: z.string(),
  choice: z.enum(["a", "b"]),
});

const createSchema = z.object({
  slateId: z.string(),
  name: z.string().trim().min(3, "Name your package").max(80),
  priceCents: z
    .number()
    .int()
    .min(PACKAGE_MIN_PRICE_CENTS, "Price too low")
    .max(PACKAGE_MAX_PRICE_CENTS, "Price too high"),
  coinPrice: z.number().int().min(1).nullable(),
  earlyBirdPriceCents: z.number().int().min(0).nullable(),
  earlyBirdUntilMs: z.number().nullable(),
  picks: z.array(pickSchema).min(1),
});

export type CreatePackageInput = z.infer<typeof createSchema>;
export type CreatePackageResult =
  | { ok: true; packageId: string }
  | { ok: false; error: string };

export async function createPackage(
  raw: CreatePackageInput,
): Promise<CreatePackageResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid package" };
  }
  const input = parsed.data;

  const db = adminDb();
  const slateRef = db.collection(COLLECTIONS.slates).doc(input.slateId);
  const slateSnap = await slateRef.get();
  if (!slateSnap.exists) return { ok: false, error: "Contest not found" };
  const slate = slateSnap.data() as SlateDoc;
  if (slate.creatorId !== uid)
    return { ok: false, error: "Only the host can sell picks for this contest" };
  if (slate.status !== "live")
    return { ok: false, error: "Contest is no longer open" };

  // Picks must cover every prediction.
  const predsSnap = await slateRef.collection(COLLECTIONS.predictions).get();
  const predIds = new Set(predsSnap.docs.map((d) => d.id));
  const picked = new Set(input.picks.map((p) => p.predictionId));
  if (
    input.picks.length !== predIds.size ||
    picked.size !== predIds.size ||
    [...picked].some((id) => !predIds.has(id))
  ) {
    return { ok: false, error: "Make a pick on every question" };
  }

  if (input.earlyBirdPriceCents !== null) {
    if (input.earlyBirdPriceCents >= input.priceCents)
      return { ok: false, error: "Early-bird price must be lower" };
    if (!input.earlyBirdUntilMs || input.earlyBirdUntilMs <= Date.now())
      return { ok: false, error: "Early-bird deadline must be in the future" };
  }

  // ABUSE MODERATION (Part 3) — the package name is creator free text that reaches buyers; screen it
  // before the write (this path has no shape check, so moderation is the only content gate here).
  const moderation = await moderateCreatorFields([{ label: "Package name", value: input.name }]);
  if (!moderation.ok) {
    return { ok: false, error: firstModerationError(moderation) ?? "That name isn't allowed." };
  }

  const ref = db.collection(COLLECTIONS.pickPackages).doc();
  await ref.set({
    creatorId: uid,
    slateId: input.slateId,
    name: input.name,
    priceCents: input.priceCents,
    coinPrice: input.coinPrice,
    earlyBirdPriceCents: input.earlyBirdPriceCents,
    earlyBirdUntil:
      input.earlyBirdPriceCents !== null && input.earlyBirdUntilMs
        ? Timestamp.fromMillis(input.earlyBirdUntilMs)
        : null,
    picks: input.picks,
    purchasesCount: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, packageId: ref.id };
}

// ── Buy ─────────────────────────────────────────────────────────────────────
export type BuyPackageResult = { ok: true } | { ok: false; error: string };

/**
 * Buy a pick package with cash or coins. Debits the buyer, records the purchase,
 * bumps the package count, and pays the creator their 40% (cash → ledger +
 * cashBalance; coins → coinBalance). Single transaction; one purchase per user.
 */
export async function buyPackage(input: {
  packageId: string;
  method: "cash" | "coins";
}): Promise<BuyPackageResult> {
  const uid = await getCurrentUserId();
  if (!uid) return { ok: false, error: "Not signed in" };

  const db = adminDb();
  const pkgRef = db.collection(COLLECTIONS.pickPackages).doc(input.packageId);
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const purchaseRef = db
    .collection(COLLECTIONS.packagePurchases)
    .doc(`${input.packageId}_${uid}`);

  try {
    await db.runTransaction(async (tx) => {
      const [pkgSnap, userSnap, purchaseSnap] = await Promise.all([
        tx.get(pkgRef),
        tx.get(userRef),
        tx.get(purchaseRef),
      ]);
      if (!pkgSnap.exists) throw new Error("NOT_FOUND");
      if (purchaseSnap.exists) throw new Error("ALREADY");
      const pkg = pkgSnap.data() as PickPackageDoc;
      const user = userSnap.data() as UserDoc | undefined;
      if (!user) throw new Error("NO_PROFILE");
      if (isSelfExcluded(user)) throw new Error("EXCLUDED");
      if (pkg.creatorId === uid) throw new Error("OWN");

      const creatorRef = db.collection(COLLECTIONS.users).doc(pkg.creatorId);

      if (input.method === "coins") {
        if (pkg.coinPrice === null) throw new Error("NO_COIN_PRICE");
        if (user.coinBalance < pkg.coinPrice) throw new Error("LOW_BALANCE");
        const creatorCoins = Math.floor(pkg.coinPrice * PACKAGE_SPLIT.creator);
        tx.update(userRef, { coinBalance: user.coinBalance - pkg.coinPrice });
        tx.set(
          purchaseRef,
          {
            userId: uid,
            packageId: input.packageId,
            paidCents: null,
            paidCoins: pkg.coinPrice,
            purchasedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.set(
          creatorRef,
          { coinBalance: FieldValue.increment(creatorCoins) },
          { merge: true },
        );
      } else {
        const now = Date.now();
        const earlyActive =
          pkg.earlyBirdPriceCents !== null &&
          pkg.earlyBirdUntil != null &&
          pkg.earlyBirdUntil.toMillis() > now;
        const priceCents = earlyActive
          ? pkg.earlyBirdPriceCents!
          : pkg.priceCents;
        if (user.cashBalanceCents < priceCents) throw new Error("LOW_BALANCE");

        const creatorNetCents = Math.floor(priceCents * PACKAGE_SPLIT.creator);
        const platformCutCents = priceCents - creatorNetCents;

        tx.update(userRef, {
          cashBalanceCents: user.cashBalanceCents - priceCents,
        });
        tx.set(
          purchaseRef,
          {
            userId: uid,
            packageId: input.packageId,
            paidCents: priceCents,
            paidCoins: null,
            purchasedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.set(
          creatorRef,
          { cashBalanceCents: FieldValue.increment(creatorNetCents) },
          { merge: true },
        );
        tx.set(
          db
            .collection(COLLECTIONS.creatorEarnings)
            .doc(`package_${input.packageId}_${uid}`),
          {
            creatorId: pkg.creatorId,
            slateId: pkg.slateId,
            earningType: "package",
            grossCents: priceCents,
            platformCutCents,
            creatorNetCents,
            createdAt: FieldValue.serverTimestamp(),
          },
        );
      }

      tx.update(pkgRef, { purchasesCount: (pkg.purchasesCount ?? 0) + 1 });
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    switch (m) {
      case "NOT_FOUND":
        return { ok: false, error: "Package not found" };
      case "ALREADY":
        return { ok: false, error: "You already own this package" };
      case "OWN":
        return { ok: false, error: "You can't buy your own package" };
      case "EXCLUDED":
        return {
          ok: false,
          error: "Your account is self-excluded. Purchases are paused.",
        };
      case "NO_COIN_PRICE":
        return { ok: false, error: "This package isn't sold for coins" };
      case "LOW_BALANCE":
        return { ok: false, error: "Insufficient balance" };
      default:
        return { ok: false, error: "Could not complete purchase" };
    }
  }

  return { ok: true };
}
