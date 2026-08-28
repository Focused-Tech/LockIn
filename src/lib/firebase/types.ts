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
  /** Keyholder attribution index (first-touch, immutable): keyholderReferrals/{referredUid}. */
  keyholderReferrals: "keyholderReferrals",
  /** Append-only keyholder qualifying-event ledger: keyholderEvents/{eventId}. NO money moves. */
  keyholderEvents: "keyholderEvents",
  /** Single-use enrolment KEYS issued by a keymaster: enrolmentKeys/{keyId}. A credential. */
  enrolmentKeys: "enrolmentKeys",
  /** A keyholder's request to join a keymaster's downline: downlineRequests/{keyholderUid}. */
  downlineRequests: "downlineRequests",
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
  /** Tutorial seen-records, one per mode: users/{uid}/tutorials/{mode}. */
  tutorials: "tutorials", // subcollection of users/{uid}
  /** Championship trigger-card seen-records (once-only): users/{uid}/championshipCards/{cardId}. */
  championshipCards: "championshipCards", // subcollection of users/{uid}
  /**
   * Append-only Locksmith moderation ledger: locksmithReports/{id}. Server-write only. Holds both
   * auto-guard blocks (input/output) and player-filed reports of a Locksmith message. NO money moves.
   */
  locksmithReports: "locksmithReports",
  /**
   * Append-only creator-content abuse reports: contentReports/{id}. Server-write only. A player flags
   * a published slate/package; server-side moderation acts on it (may unpublish). NO money moves.
   */
  contentReports: "contentReports",
  /**
   * Subcategory index (B): subcategories/{slug}. A show or league a creator can search for. Public
   * read (the creator searches it); server-write only (seeded from src/lib/subcategories/seed.ts, then
   * extended by adding docs — no deploy). Carries the domain + stat vocabulary + subject source.
   */
  subcategories: "subcategories",
  /**
   * Follower question suggestions (E): questionSuggestions/{id}. Server-write only, never client-read.
   * A follower submits a plain-language idea; it is moderated + reconstructed by the Locksmith into a
   * compliant proposal that lands in the CREATOR's queue. A follower can never publish.
   */
  questionSuggestions: "questionSuggestions",
} as const;

/** Per-user, per-mode tutorial record — users/{uid}/tutorials/{mode}. A version bump re-offers it. */
export interface TutorialDoc {
  mode: string;
  version: string;
  seen: boolean;
  seenAt: unknown; // serverTimestamp()
}

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
  /**
   * KEYHOLDER PORTAL roles — ADMIN-SET ONLY (no self-serve path; never in the client update
   * whitelist in firestore.rules). `keyholder` gates the /app/keyholder portal. `keymaster` is a
   * keyholder's upline (a keymaster is also a keyholder). `keymasterUid` is the keyholder's upline.
   */
  keyholder?: boolean;
  keymaster?: boolean;
  keymasterUid?: string | null;
  /**
   * FIRST-TOUCH, IMMUTABLE keyholder attribution — the uid of the keyholder whose code this account
   * signed up under. Stamped ONCE at signup (only when the referrer is a keyholder); never edited,
   * never re-assignable. null when this account was not referred by a keyholder.
   */
  keyholderUid?: string | null;
  /**
   * Admin / social-connect VERIFIED follower count for a creator. null = no social connect yet —
   * participation_pct renders as "—" (never 0) everywhere it's shown.
   */
  verifiedFollowers?: number | null;
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
  /** Moderation unpublish (Part 3): server sets this true to withhold a live slate from every render. */
  moderationHidden?: boolean;
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

// ── keyholderReferrals/{referredUid} ───────────────────────────────────────────
/** What a referred account BECOMES — a referred account is typed by its qualifying event. */
export type KeyholderReferralType = "creator" | "player";

/**
 * The keyholder attribution index — one doc per account referred by a keyholder, id = referredUid.
 * Written ONCE at signup (first-touch); `type` is set the first time the account qualifies as a
 * creator or a player. Never re-assigned to a different keyholder.
 */
export interface KeyholderReferralDoc {
  keyholderUid: string;
  keymasterUid: string | null;
  referredUid: string;
  referredUsername: string;
  /** null until the account qualifies (then "creator" or "player"). */
  type: KeyholderReferralType | null;
  createdAt: FsTimestamp;
  typedAt: FsTimestamp | null;
}

// ── keyholderEvents/{eventId} ──────────────────────────────────────────────────
export type KeyholderEventType =
  | "creator_activated"
  | "creator_event_settled"
  | "player_qualified";

/**
 * APPEND-ONLY qualifying-event ledger. NO money moves here — these are tracking records the portal
 * projects earnings from. Deterministic doc ids keep re-settlement idempotent; docs are created via
 * `.create()` (create-once) and never updated. `participationPct` is null when the creator has no
 * social connect (rendered "—", never 0). `grossHostFeesCents` is stored for server-side projection
 * only and is NEVER surfaced to a keyholder (privacy line).
 */
export interface KeyholderEventDoc {
  type: KeyholderEventType;
  keyholderUid: string;
  keymasterUid: string | null;
  referredUid: string;
  slateId: string | null;
  entries: number | null;
  grossHostFeesCents: number | null;
  participationPct: number | null;
  createdAt: FsTimestamp;
}

// ── locksmithReports/{id} — append-only moderation ledger (Part 2) ──────────────
/** auto_block = the guard stopped the model in/out; user_report = a player flagged a message. */
export type LocksmithReportKind = "auto_block" | "user_report";

/**
 * One Locksmith moderation record. Server-write only, append-only, never surfaced to players.
 * `context` is the surrounding transcript (trimmed) so a reviewer can see what led to it.
 */
export interface LocksmithReportDoc {
  kind: LocksmithReportKind;
  /** For auto_block: which side tripped. For user_report: "output" (they flag her messages). */
  direction: "input" | "output";
  /** Guard category (auto_block) or null (user_report). Internal only. */
  category: string | null;
  /** The offending / reported message text. */
  message: string;
  /** Trimmed surrounding conversation for review context. */
  context: { role: "user" | "assistant"; content: string }[];
  /** Optional free-text reason a reporting player gave. */
  reason: string | null;
  userId: string;
  createdAt: FsTimestamp;
}

// ── contentReports/{id} — append-only creator-abuse reports (Part 3) ─────────────
/**
 * A player's report of published creator content (slate/package). Server-write only, append-only.
 * Moderation may act on it (e.g. set the slate `withheld`). NO money moves.
 */
export interface ContentReportDoc {
  targetType: "slate" | "package";
  targetId: string;
  /** The creator who authored the reported content (for reviewer context). */
  creatorId: string | null;
  reason: string | null;
  reporterId: string;
  createdAt: FsTimestamp;
}

// ── questionSuggestions/{id} — follower suggestions reconstructed by the Locksmith (E) ────────────
/**
 * `reconstructed`  — moderated + rewritten into a compliant proposal; sits in the creator's queue.
 * `rejected_abuse` — failed the same abuse moderation as creator text; never surfaced to the creator.
 * `rejected_incompatible` — the Locksmith could not map it to an approved archetype; not surfaced.
 * `accepted` / `dismissed` — the creator acted on it. A follower can never publish.
 */
export type QuestionSuggestionStatus =
  | "reconstructed"
  | "rejected_abuse"
  | "rejected_incompatible"
  | "accepted"
  | "dismissed";

/**
 * One follower question suggestion. Server-write only, never client-read: the follower submits via a
 * server action (moderation → Locksmith reconstruction → structural guard); the creator reads their
 * queue server-side (Admin SDK). Stores WHO suggested it and WHICH slate (E.f).
 */
export interface QuestionSuggestionDoc {
  slateId: string;
  creatorId: string;
  suggestedByUid: string;
  suggestedByUsername: string;
  /** the follower's original plain-language idea. */
  rawText: string;
  status: QuestionSuggestionStatus;
  /** the Locksmith's compliant rewrite (present when status === "reconstructed"/"accepted"). */
  reconstructedQuestion: string | null;
  /** the approved archetype the suggestion was mapped to. */
  archetype: string | null;
  /** internal note: moderation category or incompatibility reason (never shown to the follower). */
  note: string | null;
  createdAt: FsTimestamp;
  reviewedAt: FsTimestamp | null;
}

// ── enrolmentKeys/{keyId} ──────────────────────────────────────────────────────
export type EnrolmentKeyStatus = "unused" | "redeemed" | "revoked";

/**
 * A single-use ENROLMENT KEY (a credential) issued by a keymaster. Redeeming it turns a person INTO a
 * keyholder inside THAT keymaster's tree. Distinct from the REFERRAL CODE (= username), which is
 * public, permanent, and grants nothing. `code` is the redeemable secret; server verifies + burns it.
 */
export interface EnrolmentKeyDoc {
  code: string;
  keymasterUid: string; // tree binding — never changes who a redeemed key attributes to
  label: string | null; // optional "who it's for"
  status: EnrolmentKeyStatus;
  expiresAt: FsTimestamp | null;
  redeemedByUid: string | null;
  redeemedByUsername: string | null;
  redeemedAt: FsTimestamp | null;
  createdAt: FsTimestamp;
}

// ── downlineRequests/{keyholderUid} ────────────────────────────────────────────
export type DownlineRequestStatus = "pending" | "approved" | "declined";

/**
 * A KEYHOLDER's request to be placed in a keymaster's downline. Keyholders cannot enrol themselves or
 * make keys — a request is their only path into a tree; the target keymaster approves it. One doc per
 * keyholder (id = keyholderUid), so a new request replaces any prior one.
 */
export interface DownlineRequestDoc {
  keyholderUid: string;
  keyholderUsername: string;
  keymasterUid: string;
  keymasterUsername: string;
  status: DownlineRequestStatus;
  createdAt: FsTimestamp;
  resolvedAt: FsTimestamp | null;
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
