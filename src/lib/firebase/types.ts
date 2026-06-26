/**
 * Firestore document shapes for LockIn.
 *
 * Conventions (unchanged from the relational model):
 *   - All money is stored in CENTS (integer).
 *   - Timestamps are Firestore Timestamps ({@link FsTimestamp}); written with
 *     serverTimestamp().
 *   - Enum-like fields use string unions; validate on write in security rules
 *     and server code.
 *
 * Data model (NoSQL):
 *   users/{userId}
 *   slates/{slateId}
 *   slates/{slateId}/predictions/{predictionId}
 *   slates/{slateId}/entries/{entryId}
 *   deposits/{depositId}
 *   withdrawals/{withdrawalId}
 *   pickPackages/{packageId}
 *   creatorEarnings/{earningId}
 */

/** Structural Firestore timestamp — satisfied by both the web and admin SDKs. */
export interface FsTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

/** Firestore collection / subcollection path names — import these, never hardcode. */
export const COLLECTIONS = {
  users: "users",
  slates: "slates",
  predictions: "predictions", // subcollection of slates/{id}
  entries: "entries", // subcollection of slates/{id}
  categoryStats: "categoryStats", // subcollection of users/{uid}
  deposits: "deposits",
  withdrawals: "withdrawals",
  pickPackages: "pickPackages",
  packagePurchases: "packagePurchases",
  creatorEarnings: "creatorEarnings",
  /** Reservation docs enforcing username uniqueness: usernames/{lower} → { uid }. */
  usernames: "usernames",
  /** Referral records: referrals/{referredUid}. */
  referrals: "referrals",
  /** Creator applications: creatorApplications/{userId}. */
  creatorApplications: "creatorApplications",
  /** Cross-slate parlays: crossParlays/{parlayId}. */
  crossParlays: "crossParlays",
} as const;

export type KycStatus = "none" | "pending" | "verified" | "failed";
export type CreatorTier = "basic" | "pro" | "elite" | "partner";
export type SlateStatus =
  | "draft"
  | "live"
  | "locked"
  | "settling"
  | "pending_review"
  | "settled"
  | "cancelled";
export type PredictionType = "binary" | "over_under";
export type EntryTierValue = 5 | 10 | 25;

// ── users/{userId} ─────────────────────────────────────────────────────────────
export interface UserDoc {
  username: string;
  email: string;
  dateOfBirth: string; // YYYY-MM-DD
  avatarUrl: string | null;
  coinBalance: number;
  cashBalanceCents: number;
  kycStatus: KycStatus;
  kycProviderId: string | null;
  kycVerifiedAt: FsTimestamp | null;
  geoState: string | null;
  registeredState: string | null;
  stripeCustomerId: string | null;
  isCreator: boolean;
  creatorVerified: boolean;
  creatorTier: CreatorTier;
  creatorStripeConnectId: string | null;
  /** True once the connected account can receive payouts (Stripe Connect). */
  creatorPayoutsEnabled: boolean;
  proSubscriber: boolean;
  proExpiresAt: FsTimestamp | null;
  stripeSubscriptionId: string | null;
  depositLimitDailyCents: number;
  depositLimitWeeklyCents: number;
  depositLimitMonthlyCents: number;
  selfExclusionUntil: FsTimestamp | null;
  /** Selected interest categories (replaces auth metadata). */
  categories: string[];
  /** Guided first-pick tour: completion + resume position. */
  hasCompletedTour: boolean;
  currentTourStep: number;
  /** Creator uids this user follows (drives "For you" recommendations). */
  followedCreators: string[];
  /** FCM/APNs device tokens for push notifications (native app). */
  deviceTokens: string[];
  /** Referral: the uid of whoever referred this user, if any. */
  referredBy: string | null;
  /** Whether the paid-conversion referral bonus has been paid to the referrer. */
  referralRewarded: boolean;
  /** How many users this user has referred. */
  referralCount: number;
  /** Cumulative cash earned from referrals (cents). */
  referralEarningsCents: number;
  createdAt: FsTimestamp;
}

// ── slates/{slateId} ───────────────────────────────────────────────────────────
export interface EntryTierConfig {
  tier: EntryTierValue;
  hostingFeeCents: number;
}

export interface SlateDoc {
  creatorId: string | null; // null for platform-curated slates
  title: string;
  description: string | null;
  category: string;
  status: SlateStatus;
  entryTiers: EntryTierConfig[];
  /** Denormalized live entry count — drives the feed's prize-pool display. */
  entryCount: number;
  /** Card Rush: boosted, time-limited, capped contest (purple branding). */
  isCardRush: boolean;
  /** Prize multiplier (1 for normal slates; 2 or 3 for a Card Rush). */
  rushMultiplier: number;
  /** Max entries for a Card Rush, else null (uncapped). */
  maxEntries: number | null;
  lockTime: FsTimestamp;
  promotionOpensAt: FsTimestamp;
  settledAt: FsTimestamp | null;
  cancelledAt: FsTimestamp | null;
  creatorBonusCents: number;
  createdAt: FsTimestamp;
}

// ── slates/{slateId}/predictions/{predictionId} ────────────────────────────────
export interface PredictionDoc {
  question: string;
  optionA: string;
  optionB: string;
  optionAProbability: number | null; // 0–100
  optionBProbability: number | null;
  optionAMultiplier: number | null;
  optionBMultiplier: number | null;
  predictionType: PredictionType;
  overUnderLine: number | null;
  result: "a" | "b" | null;
  verificationSources: string[] | null;
  verificationConfidence: number | null; // 0–100
  sortOrder: number;
}

// ── slates/{slateId}/entries/{entryId} ─────────────────────────────────────────
export interface EntryPick {
  predictionId: string;
  choice: "a" | "b";
}

export interface EntryDoc {
  userId: string;
  entryTier: EntryTierValue;
  hostingFeeCents: number;
  isPaid: boolean;
  coinCost: number | null;
  picks: EntryPick[];
  score: number | null;
  rank: number | null;
  payoutCents: number | null;
  payoutCoins: number | null;
  /** True when the entry was refunded (tier under the min-participant floor). */
  refunded: boolean;
  submittedAt: FsTimestamp;
}

// ── users/{userId}/categoryStats/{category} ────────────────────────────────────
/**
 * Per-category settled-contest aggregate for a player. Doc id is the category
 * name. Incremented at settlement (Admin SDK); never written by the client.
 * Win rate is derived on read (wins / plays).
 */
export interface CategoryStatDoc {
  category: string;
  plays: number;
  wins: number;
  totalWonCents: number;
  updatedAt: FsTimestamp;
}

// ── deposits/{depositId} ───────────────────────────────────────────────────────
export interface DepositDoc {
  userId: string;
  amountCents: number;
  feeCents: number;
  paymentMethod: "card" | "ach" | null;
  stripePaymentIntentId: string | null;
  status: "pending" | "succeeded" | "failed";
  createdAt: FsTimestamp;
}

// ── withdrawals/{withdrawalId} ─────────────────────────────────────────────────
export interface WithdrawalDoc {
  userId: string;
  amountCents: number;
  stripePayoutId: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: FsTimestamp;
  completedAt: FsTimestamp | null;
}

// ── pickPackages/{packageId} ───────────────────────────────────────────────────
export interface PickPackageDoc {
  creatorId: string;
  slateId: string;
  name: string;
  priceCents: number;
  coinPrice: number | null;
  earlyBirdPriceCents: number | null;
  earlyBirdUntil: FsTimestamp | null;
  picks: EntryPick[]; // encrypted until lock in real flow
  purchasesCount: number;
  createdAt: FsTimestamp;
}

// ── packagePurchases/{purchaseId} (id = `${packageId}_${userId}`) ──────────────
export interface PackagePurchaseDoc {
  userId: string;
  packageId: string;
  paidCents: number | null;
  paidCoins: number | null;
  purchasedAt: FsTimestamp;
}

// ── referrals/{referredUid} ────────────────────────────────────────────────────
export interface ReferralDoc {
  referrerUid: string;
  referredUid: string;
  referredUsername: string;
  status: "signed_up" | "converted";
  rewardCoins: number;
  rewardCents: number;
  signupAt: FsTimestamp;
  convertedAt: FsTimestamp | null;
}

// ── creatorApplications/{userId} ───────────────────────────────────────────────
export type CreatorApplicationStatus = "pending" | "approved" | "rejected";

/** A user's request to become a verified creator. Doc id = applicant uid. */
export interface CreatorApplicationDoc {
  userId: string;
  username: string;
  /** Primary audience channel link (YouTube/TikTok/X/etc.). */
  audienceUrl: string;
  /** Self-reported follower/subscriber count. */
  audienceSize: number;
  /** Categories the creator wants to host. */
  categories: string[];
  /** Why they'd be a good host. */
  pitch: string;
  status: CreatorApplicationStatus;
  /** Admin note recorded on approve/reject. */
  reviewNote: string | null;
  /** Reviewing admin's uid. */
  reviewedBy: string | null;
  createdAt: FsTimestamp;
  reviewedAt: FsTimestamp | null;
}

// ── crossParlays/{parlayId} ────────────────────────────────────────────────────
export type CrossParlayPickStatus = "pending" | "correct" | "incorrect" | "void";
export type CrossParlayStatus = "open" | "ready" | "settled" | "refunded";

export interface CrossParlayPick {
  slateId: string;
  predictionId: string;
  pickValue: "a" | "b";
  /** Denormalized for display on the history page (no per-pick joins). */
  slateTitle: string;
  question: string;
  pickLabel: string;
  /** Denormalized slate lock time — scoring orders picks by this. */
  lockTimeMs: number;
  status: CrossParlayPickStatus;
}

/** A single entry combining picks across multiple slates. */
export interface CrossParlayDoc {
  userId: string;
  picks: CrossParlayPick[];
  /** Denormalized slate ids (array-contains query when a slate settles). */
  slateIds: string[];
  entryTier: EntryTierValue;
  isPaid: boolean;
  coinCost: number | null;
  /** Display multiplier from the pick-count curve. */
  parlayMultiplier: number;
  status: CrossParlayStatus;
  totalScore: number | null;
  rank: number | null;
  payoutCents: number | null;
  payoutCoins: number | null;
  refunded: boolean;
  submittedAt: FsTimestamp;
  settledAt: FsTimestamp | null;
}

// ── creatorEarnings/{earningId} ────────────────────────────────────────────────
export interface CreatorEarningDoc {
  creatorId: string;
  slateId: string | null;
  earningType: "hosting" | "package" | "referral" | "pro_commission";
  grossCents: number;
  platformCutCents: number;
  creatorNetCents: number;
  createdAt: FsTimestamp;
}

/** A document paired with its Firestore id. */
export type WithId<T> = T & { id: string };
