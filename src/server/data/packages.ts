import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type PickPackageDoc,
  type PredictionDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";

export interface MarketPackage {
  id: string;
  name: string;
  slateId: string;
  slateTitle: string;
  category: string;
  status: string;
  creatorId: string;
  creatorName: string;
  priceCents: number;
  coinPrice: number | null;
  effectivePriceCents: number;
  earlyBirdActive: boolean;
  purchasesCount: number;
}

export interface RevealedPick {
  question: string;
  choiceLabel: string;
}

export interface OwnedPackage extends MarketPackage {
  isOwnedByYou: boolean; // you created it
  picks: RevealedPick[];
}

export interface Marketplace {
  available: MarketPackage[];
  owned: OwnedPackage[];
}

const LIMIT = 100;

/** Build the pick-package marketplace for a viewer (available + their owned). */
export async function fetchMarketplace(
  db: Firestore,
  uid: string,
): Promise<Marketplace> {
  const [pkgSnap, purchaseSnap] = await Promise.all([
    db.collection(COLLECTIONS.pickPackages).limit(LIMIT).get(),
    db.collection(COLLECTIONS.packagePurchases).where("userId", "==", uid).get(),
  ]);

  const purchasedIds = new Set(
    purchaseSnap.docs.map((d) => (d.data() as { packageId: string }).packageId),
  );

  const packages = pkgSnap.docs.map((d) => ({
    id: d.id,
    data: d.data() as PickPackageDoc,
  }));

  // Batch-load slates + creators.
  const slateIds = [...new Set(packages.map((p) => p.data.slateId))];
  const creatorIds = [...new Set(packages.map((p) => p.data.creatorId))];
  const [slateSnaps, creatorSnaps] = await Promise.all([
    slateIds.length
      ? db.getAll(...slateIds.map((id) => db.collection(COLLECTIONS.slates).doc(id)))
      : Promise.resolve([]),
    creatorIds.length
      ? db.getAll(...creatorIds.map((id) => db.collection(COLLECTIONS.users).doc(id)))
      : Promise.resolve([]),
  ]);
  const slateById = new Map(slateSnaps.map((s) => [s.id, s.data() as SlateDoc]));
  const nameById = new Map(
    creatorSnaps.map((s) => [s.id, (s.data() as UserDoc | undefined)?.username]),
  );

  const now = Date.now();
  const toMarket = (id: string, p: PickPackageDoc): MarketPackage | null => {
    const slate = slateById.get(p.slateId);
    if (!slate) return null;
    const earlyBirdActive =
      p.earlyBirdPriceCents !== null &&
      p.earlyBirdUntil != null &&
      p.earlyBirdUntil.toMillis() > now;
    return {
      id,
      name: p.name,
      slateId: p.slateId,
      slateTitle: slate.title,
      category: slate.category,
      status: slate.status,
      creatorId: p.creatorId,
      creatorName: nameById.get(p.creatorId) ?? "creator",
      priceCents: p.priceCents,
      coinPrice: p.coinPrice,
      effectivePriceCents: earlyBirdActive
        ? p.earlyBirdPriceCents!
        : p.priceCents,
      earlyBirdActive,
      purchasesCount: p.purchasesCount ?? 0,
    };
  };

  // Cache predictions per slate for reveals.
  const predsCache = new Map<string, Map<string, PredictionDoc>>();
  async function predsFor(slateId: string) {
    const cached = predsCache.get(slateId);
    if (cached) return cached;
    const snap = await db
      .collection(COLLECTIONS.slates)
      .doc(slateId)
      .collection(COLLECTIONS.predictions)
      .get();
    const map = new Map(snap.docs.map((d) => [d.id, d.data() as PredictionDoc]));
    predsCache.set(slateId, map);
    return map;
  }

  const available: MarketPackage[] = [];
  const owned: OwnedPackage[] = [];

  for (const { id, data } of packages) {
    const market = toMarket(id, data);
    if (!market) continue;

    const minePurchased = purchasedIds.has(id);
    const mineCreated = data.creatorId === uid;

    if (minePurchased || mineCreated) {
      const preds = await predsFor(data.slateId);
      const picks: RevealedPick[] = data.picks.map((pick) => {
        const pred = preds.get(pick.predictionId);
        return {
          question: pred?.question ?? "Pick",
          choiceLabel: pred
            ? pick.choice === "a"
              ? pred.optionA
              : pred.optionB
            : pick.choice.toUpperCase(),
        };
      });
      owned.push({ ...market, isOwnedByYou: mineCreated, picks });
    } else if (market.status === "live") {
      available.push(market);
    }
  }

  available.sort((a, b) => b.purchasesCount - a.purchasesCount);
  return { available, owned };
}
