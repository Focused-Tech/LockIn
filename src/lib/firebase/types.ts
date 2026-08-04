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
  /** Beginner-journey entries: beginnerEntries/{entryId}. */
  beginnerEntries: "beginnerEntries",
  /** Multiplayer PRACTICE contests (play-money): practiceContests/{contestId}. */
  practiceContests: "practiceContests",
  /** Fox Pit practice trivia — one doc per question: triviaQuestions/{id}. */
  triviaQuestions: "triviaQuestions",
  /** Fox Pit trivia batch records (active + archived): triviaBatches/{batchId}. */
  triviaBatches: "triviaBatches",
  /** Questions a player has already been dealt: users/{uid}/triviaSeen/{questionId}. */
  triviaSeen: "triviaSeen", // subcollection of users/{uid}
  /**
   * PRACTICE entries: practiceContests/{id}/practiceEntries/{uid}. Deliberately
   * NOT named "entries" so collectionGroup("entries") scans (the REAL-money
   * leaderboard, rec signals, wallet activity) can never sweep up practice play.
   */
  practiceEntries: "practiceEntries",
  /** Creator agreement signatures (append-only audit trail): users/{uid}/creatorSignatures/{version_section}. */
  creatorSignatures: "creatorSignatures", // subcollection of users/{uid}
} as const;

/** Which Explore lane a user has chosen (set at onboarding, switchable later). */
export type JourneyLane = "beginner" | "advanced";

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
export type PredictionType = "binary" | "over_under" | "archetype";

/** §2.1 — a pickable option on a cross-game (archetype) prediction. One per player for the
 *  "top composite" archetypes; a duo ("A"/"B") for split-squad; a count bucket for milestone. */
export interface ProLegOption {
  key: string;
  playerNames?: string[];
  bucket?: [number, number];
}
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
  /** §2 — the accepted penalty-of-perjury residence attestation (the cash-entry gate; NOT ID/KYC,
   *  which is deferred to the withdrawal threshold). Present once the player has attested. */
  cashAttestation?: { affirmedState: string; acceptedAt: FsTimestamp; text: string; version: string } | null;
  stripeCustomerId: string | null;
  /** Platform owner/admin. Gates the web admin dashboard (/admin). */
  isAdmin?: boolean;
  isCreator: boolean;
  creatorVerified: boolean;
  creatorTier: CreatorTier;
  creatorStripeConnectId: string | null;
  /** True once the connected account can receive payouts (Stripe Connect). */
  creatorPayoutsEnabled: boolean;
  /** Creator-agreement gate: set true only when ALL sections of `creatorAgreementVersion`
   *  are signed. A version bump (counsel edit) leaves the old version here → re-sign. */
  creatorOnboarded?: boolean;
  /** The agreement version the creator has fully signed (matched against AGREEMENT_VERSION). */
  creatorAgreementVersion?: string;
  proSubscriber: boolean;
  proExpiresAt: FsTimestamp | null;
  stripeSubscriptionId: string | null;
  depositLimitDailyCents: number;
  depositLimitWeeklyCents: number;
  depositLimitMonthlyCents: number;
  selfExclusionUntil: FsTimestamp | null;
  /** Selected interest categories (replaces auth metadata). */
  categories: string[];
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
  /**
   * Chosen Explore lane. Undefined for users created before the beginner journey
   * shipped (they default to the advanced/existing Explore). Set at onboarding
   * and switchable from the in-feed lane toggle.
   */
  journeyLane?: JourneyLane;
  /**
   * Creator's historical pick hit-rate (0–100) shown on beginner cards. There is
   * NO engine computing this yet (creator-accuracy scoring is unbuilt), so it is
   * null/undefined for real creators and surfaced honestly ("no track record
   * yet") rather than faked. Seed data sets it for demo creators so the journey
   * is walkable. Only meaningful on docs where isCreator is true.
   */
  creatorHitRate?: number | null;
  /**
   * PRACTICE MODE (play-money) balances — SCORE ONLY. Completely separate from
   * coinBalance/cashBalanceCents: never cashable, transferable, purchasable-with,
   * or redeemable, and buy nothing. Undefined for users predating practice mode
   * (treated as the 500 starting balance lazily). Shares no value with real slates.
   */
  practiceCoins?: number;
  /** Lifetime practice coins earned — drives the EARNED rank tier (title). */
  practiceLifetimeCoins?: number;
  /** Current practice win streak (for streak rewards + the rare funnel nudge). */
  practiceStreak?: number;
  /**
   * AI-SIMULATED creators this user follows in PRACTICE mode (ids like `ai_*`).
   * Kept SEPARATE from `followedCreators` (real creators / rec engine) so the
   * simulated training roster never leaks into real-creator recommendations.
   */
  followedAiCreators?: string[];
  /** Rolling recent practice results (true=win) for the dynamic difficulty tune. */
  practiceRecent?: boolean[];
  /** Epoch ms when the busted player's free DAILY refill becomes claimable. */
  practiceRefillAt?: number | null;
  createdAt: FsTimestamp;
}

// ── practiceContests/{contestId} (multiplayer PRACTICE — play-money) ─────────────
export type PracticeContestStatus = "open" | "closed";

/** Per-option context (§2 leg layout) — game line · season average · last-out form.
 *  Empty strings when the archetype carries context at the leg level (milestone chips
 *  put the counted players + context on the leg `sub`, not on each bucket). */
export interface PracticeOptionContext {
  gameLine: string;
  seasonAvg: string;
  lastOut: string;
}
/** One selectable option on a practice leg — the consensus % is `prob`. */
export interface PracticeOption {
  label: string;
  /** Consensus share, 0–100. Options on a leg sum to ~100. */
  prob: number;
  context: PracticeOptionContext;
}
/** A practice leg shown to players (NO outcome — outcomes are server-only). N options
 *  (2..N), sourced from the shared archetype library. */
export interface PracticeLeg {
  id: string;
  question: string;
  /** Leg sub-line — milestone_count names the counted players + their context here. */
  sub?: string;
  options: PracticeOption[];
  /** The leg's archetype id (one of the approved six; "manual" for host-authored legs). */
  archetype: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface PracticeContestDoc {
  hostId: string;
  hostUsername: string;
  title: string;
  category: string;
  /** 6-char invite/join code (shareable). */
  inviteCode: string;
  status: PracticeContestStatus;
  /** "ai" = engine-generated (SLATE_MODEL); "manual" = host wrote the legs. */
  mode: "ai" | "manual";
  /**
   * Set when this contest is hosted by an AI-SIMULATED creator (training
   * opponent), e.g. `ai_longshot`. Drives the honest "AI" host label. Absent for
   * player-hosted contests; later, real creators are hosted by their real uid.
   */
  aiCreatorId?: string;
  /**
   * URGENCY (countdown + spot race) — epoch ms when the countdown started
   * (≈ creation) and when it locks. Labeled mock players claim the top spots as
   * the clock winds down; the spot a player lands in scales their SCORE payout.
   * Absent on contests created before the mechanic shipped (treated as no race).
   */
  urgencyStartAt?: number;
  urgencyLockAt?: number;
  /** Tier the contest was scaled to. */
  tier: string;
  /** Practice-coin stake every entrant puts up (SCORE only). */
  stakeCoins: number;
  legs: PracticeLeg[];
  /**
   * Hidden, pre-rolled per-leg outcomes as OPTION INDEXES (0-based), revealed to a
   * player only after they submit. SERVER-ONLY — never sent to clients before
   * settlement. Legacy docs stored "a"/"b" — read those as index 0/1.
   */
  outcomes: number[];
  entryCount: number;
  createdAt: FsTimestamp;
}

// ── practiceContests/{contestId}/entries/{uid} ──────────────────────────────────
export interface PracticeEntryDoc {
  userId: string;
  username: string;
  /** Rank tier at submit time (for the leaderboard badge). */
  tier: string;
  /** Player's picks as OPTION INDEXES (0-based), in leg order. Legacy: "a"/"b" = 0/1. */
  picks: number[];
  correct: number;
  score: number; // = correct count (used to rank)
  netCoins: number;
  won: boolean;
  submittedAt: FsTimestamp;
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
  /** Data-feed origin: "espn" | "oddsapi" for real games (settled from final scores), else absent. */
  source?: string;
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
  /** binary result stays "a"|"b"; an archetype prediction resolves to a winning option KEY (§2.3). */
  result: string | null;
  verificationSources: string[] | null;
  verificationConfidence: number | null; // 0–100
  sortOrder: number;
  /** §2.1 cross-game fields (present only when predictionType === "archetype"). */
  archetype?: string;
  proOptions?: ProLegOption[];
  /** first-to-N target / milestone bar on the fantasy composite; players tallied for milestone. */
  bar?: number | null;
  countedPlayers?: string[] | null;
}

// ── slates/{slateId}/entries/{entryId} ─────────────────────────────────────────
export interface EntryPick {
  predictionId: string;
  /** §2.1 — the chosen option KEY. Binary predictions use "a"|"b"; archetype predictions use one of
   *  the prediction's proOptions keys (a player name, a duo "A"/"B", or a count bucket). */
  choice: string;
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

// ── beginnerEntries/{entryId} ──────────────────────────────────────────────────
/** One leg of a beginner combo: a yes/no call on a single prediction. */
export interface BeginnerEntryLeg {
  slateId: string;
  predictionId: string;
  /** The user's call. */
  choice: "a" | "b";
  /** Denormalized for display (no joins on the history view). */
  question: string;
  pickLabel: string;
}

/**
 * A beginner-journey entry: 1–4 yes/no legs staked in coins. The coin debit is
 * REAL and persisted here. Settlement is NOT wired — there is no real scoring of
 * these entries yet (out of scope); `winUpToCoins` is the illustrative tunable
 * projection captured at lock time, not a settled payout.
 */
export interface BeginnerEntryDoc {
  userId: string;
  creatorId: string | null;
  legs: BeginnerEntryLeg[];
  stakeCoins: number;
  /** Illustrative "win up to" from the tunable model at lock time (not settled). */
  winUpToCoins: number;
  /** Always false until a real beginner-settlement engine exists. */
  settled: boolean;
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

/**
 * One signed section of the Creator Agreement. Append-only audit trail at
 * users/{uid}/creatorSignatures/{version}_{section} — a version bump writes NEW docs
 * and never overwrites the old ones (the history is the enforceable record).
 */
export interface CreatorSignatureDoc {
  section: string; // SectionKey
  version: string; // AGREEMENT_VERSION at signing
  signedAt: FsTimestamp;
}

/** A document paired with its Firestore id. */
export type WithId<T> = T & { id: string };
