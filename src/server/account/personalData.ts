/**
 * PERSONAL-DATA MAP — the one place that says, for EVERY Firestore collection, where a given user's
 * personal data lives in it and what happens to that data when the account is deleted.
 *
 * Why a map and not ad-hoc queries: a deletion that forgets a collection is indistinguishable, from
 * the outside, from one that handled it. The map is exhaustive over `COLLECTIONS` and the gate test
 * asserts that — add a collection to the registry without classifying it here and the suite fails.
 *
 * Three strategies, and the line between them is not stylistic:
 *
 *   delete     The record is the user's own and nothing else depends on it. It goes.
 *   anonymize  The record must survive because SOMEONE ELSE depends on it — a money movement we are
 *              required to keep (deposits, withdrawals, earnings), a contest other players entered,
 *              or an append-only moderation/audit trail. The user's identity is severed from it by
 *              overwriting the linking field with a tombstone; nothing else is read or copied.
 *   none       The collection holds no per-user personal data at all.
 *
 * Deliberately NOT server-only: this file is pure data + pure functions so the gate test can import
 * and reason about it directly rather than scraping it as text.
 */
import { COLLECTIONS } from "@/lib/firebase/types";

/** What happens to a record when the account that appears in it is deleted. */
export type DeletionStrategy = "delete" | "anonymize" | "none";

/**
 * How the user's uid is found inside a collection.
 *  - `docId`         the document id IS the uid (e.g. entries/{uid})
 *  - `field`         a top-level field holds the uid; `group` means it's a subcollection reached by
 *                    a collectionGroup query rather than a top-level collection
 *  - `subcollection` lives under users/{uid}/… and is reached through the parent, never queried
 *  - `arrayField`    the uid appears as a MEMBER of an array on OTHER users' documents
 *  - `docIdOther`    the document id is some other user-derived key (the lowercased username)
 */
export type Locator =
  | { kind: "docId" }
  | { kind: "field"; field: string; group?: boolean }
  | { kind: "subcollection" }
  | { kind: "arrayField"; field: string }
  | { kind: "docIdOther"; from: "usernameLower" };

export interface PersonalDataRule {
  /** Key in COLLECTIONS. */
  collection: keyof typeof COLLECTIONS;
  /** Every place this user's uid can appear in this collection. Empty ⇒ strategy must be "none". */
  locators: Locator[];
  strategy: DeletionStrategy;
  /** Included in the user's data export when true. Only their OWN records. */
  exportable: boolean;
  /**
   * Fields on an exported document that can hold the OTHER party's account id or handle — a referral
   * has two sides, an enrolment key has an issuer and a redeemer. Those values are redacted from the
   * export: the record is this user's to receive, but the counterparty's identifier is not.
   * Values matching the requesting user's own uid/username are left intact.
   */
  redactFields?: string[];
  /** Why this strategy. Shown to the user (grouped) and read by the gate test. */
  why: string;
}

/** The tombstone written over a linking field when a record is anonymized rather than deleted. */
export const DELETED_USER_SENTINEL = "deleted_user";

/**
 * EXHAUSTIVE over COLLECTIONS. One rule per collection, no exceptions — see the gate test.
 */
export const PERSONAL_DATA_MAP: PersonalDataRule[] = [
  {
    collection: "users",
    locators: [{ kind: "docId" }],
    strategy: "delete",
    exportable: true,
    // Inbound relationships name a third party the user cannot necessarily see in the app (who
    // referred them, which keyholder they sit under), so those ids are redacted. `followedCreators`
    // is NOT redacted — it is the user's own list and the app shows it to them already.
    redactFields: ["referredBy", "keyholderUid", "keymasterUid"],
    why: "The profile itself. Deleted outright, together with every subcollection beneath it.",
  },
  {
    collection: "categoryStats",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: true,
    why: "Per-category performance under the profile. Deleted with the parent.",
  },
  {
    collection: "triviaSeen",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: false,
    why: "Which practice questions were dealt to this player. Deleted with the parent.",
  },
  {
    collection: "taxYears",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: true,
    why: "Annual tax rollup (users/{uid}/taxYears/{year}). FLAG FOR REVIEW: like every subcollection rule here, this goes with the parent doc — there is no subcollection-level anonymize path today. Tax rollups may need real retention (IRS record-keeping), which this doesn't yet provide; exported first so the user keeps their own copy before it goes.",
  },
  {
    collection: "tutorials",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: false,
    why: "Tutorial seen-records. Deleted with the parent.",
  },
  {
    collection: "championshipCards",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: false,
    why: "Which one-time cards this player has been shown. Deleted with the parent.",
  },
  {
    collection: "creatorSignatures",
    locators: [{ kind: "subcollection" }],
    strategy: "delete",
    exportable: true,
    why: "Creator-agreement signatures. Exported first so the signer keeps their own copy, then deleted with the parent.",
  },
  {
    collection: "usernames",
    locators: [{ kind: "docIdOther", from: "usernameLower" }],
    strategy: "delete",
    exportable: false,
    why: "The uniqueness reservation. Deleting it releases the handle.",
  },
  {
    collection: "entries",
    // A subcollection of slates/{id}; the doc id is the uid, but it is only addressable through a
    // collectionGroup query, and every entry carries `userId`, so the group query finds all of them.
    locators: [{ kind: "field", field: "userId", group: true }],
    strategy: "delete",
    exportable: true,
    why: "Contest entries. Deletion is blocked while any of them sit in an unsettled contest, so nothing is ever removed from a contest still being scored.",
  },
  {
    collection: "beginnerEntries",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "delete",
    exportable: true,
    why: "Beginner-journey entries. Same blocking rule as contest entries.",
  },
  {
    collection: "crossParlays",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "delete",
    exportable: true,
    why: "This player's own multi-slate cards. Nobody else's result depends on them.",
  },
  {
    collection: "practiceEntries",
    // Subcollection of practiceContests/{id}; same shape as `entries` — reached by group query.
    locators: [{ kind: "field", field: "userId", group: true }],
    strategy: "delete",
    exportable: true,
    why: "Play-money practice entries. No cash ever moved through them.",
  },
  {
    collection: "packagePurchases",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "delete",
    exportable: true,
    why: "Entitlement records for packs this player bought. The money movement itself is kept separately in the earnings ledger.",
  },
  {
    collection: "creatorApplications",
    locators: [{ kind: "docId" }],
    strategy: "delete",
    exportable: true,
    why: "This user's own application to host contests.",
  },

  /* ── Anonymized: someone else depends on the record surviving ─────────────────────────────── */
  {
    collection: "deposits",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "anonymize",
    exportable: true,
    why: "Money-in records. Kept as required financial records with the account link severed.",
  },
  {
    collection: "withdrawals",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "anonymize",
    exportable: true,
    why: "Money-out records. Kept as required financial records with the account link severed.",
  },
  {
    collection: "winningsLedger",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "anonymize",
    exportable: true,
    why: "Immutable per-contest winnings ledger (winningsLedger/{slateId}_{uid}) — a required financial/tax record. Kept with the account link severed.",
  },
  {
    collection: "w9Forms",
    locators: [{ kind: "docId" }],
    strategy: "anonymize",
    exportable: false,
    why: "W-9 tax-info record (w9Forms/{uid}). Required tax documentation — kept, not deleted; not exported because it holds tax-filing PII, not general account data.",
  },
  {
    collection: "creatorEarnings",
    locators: [{ kind: "field", field: "creatorId" }],
    strategy: "anonymize",
    exportable: true,
    why: "The earnings ledger. Kept as a required financial record with the account link severed.",
  },
  {
    collection: "slates",
    locators: [{ kind: "field", field: "creatorId" }],
    strategy: "anonymize",
    exportable: true,
    why: "Contests this creator hosted, which other players entered and which carry their own results. Kept, with the host link severed.",
  },
  {
    collection: "pickPackages",
    locators: [{ kind: "field", field: "creatorId" }],
    strategy: "anonymize",
    exportable: true,
    why: "Packs other players already bought. Buyers keep what they paid for; the author link is severed.",
  },
  {
    collection: "practiceContests",
    locators: [{ kind: "field", field: "hostId" }],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["hostId", "hostUsername"],
    why: "Practice contests other players joined. Kept, with the host link severed.",
  },
  {
    collection: "referrals",
    locators: [
      { kind: "docId" },
      { kind: "field", field: "referrerUid" },
    ],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["referrerUid", "referredUid", "referredUsername"],
    why: "Referral records. The other side of the referral keeps their credit; this account's link is severed.",
  },
  {
    collection: "keyholderReferrals",
    locators: [
      { kind: "docId" },
      { kind: "field", field: "keyholderUid" },
    ],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["keyholderUid", "keymasterUid", "referredUid", "referredUsername"],
    why: "First-touch keyholder attribution. A keyholder keeps the credit they earned; this account's link is severed.",
  },
  {
    collection: "keyholderEvents",
    locators: [
      { kind: "field", field: "keyholderUid" },
      { kind: "field", field: "referredUid" },
    ],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["keyholderUid", "keymasterUid", "referredUid"],
    why: "Append-only qualifying-event ledger behind keyholder credit. Kept, with the account link severed.",
  },
  {
    collection: "downlineRequests",
    locators: [
      { kind: "docId" },
      { kind: "field", field: "keymasterUid" },
    ],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["keyholderUid", "keymasterUid", "keyholderUsername", "keymasterUsername"],
    why: "Placement requests between a keyholder and their upline. The other party's record survives; this account's link is severed.",
  },
  {
    collection: "enrolmentKeys",
    locators: [
      { kind: "field", field: "keymasterUid" },
      { kind: "field", field: "redeemedByUid" },
    ],
    strategy: "anonymize",
    exportable: true,
    redactFields: ["keymasterUid", "redeemedByUid", "redeemedByUsername"],
    why: "Issued enrolment keys. The tree binding survives; this account's link is severed.",
  },
  {
    collection: "locksmithReports",
    locators: [{ kind: "field", field: "userId" }],
    strategy: "anonymize",
    exportable: false,
    why: "Append-only safety/moderation ledger. Kept for abuse review with the account link severed; never exported, because it holds review notes rather than the user's own content.",
  },
  {
    collection: "contentReports",
    locators: [
      { kind: "field", field: "reporterId" },
      { kind: "field", field: "creatorId" },
    ],
    strategy: "anonymize",
    exportable: false,
    why: "Append-only abuse reports. Kept for moderation with the account link severed; not exported, because exporting would expose who reported whom.",
  },
  {
    collection: "questionSuggestions",
    locators: [
      { kind: "field", field: "suggestedByUid" },
      { kind: "field", field: "creatorId" },
    ],
    strategy: "anonymize",
    exportable: false,
    why: "Follower suggestions the Locksmith reconstructed into the creator's queue. Kept (the creator's queue references it) with both account links severed; not exported — the Firestore rules never let a follower read this collection back either (server-only end to end), so the export shouldn't either.",
  },

  /* ── No per-user personal data ────────────────────────────────────────────────────────────── */
  {
    collection: "predictions",
    locators: [],
    strategy: "none",
    exportable: false,
    why: "Questions on a contest. Carries no player identity.",
  },
  {
    collection: "triviaQuestions",
    locators: [],
    strategy: "none",
    exportable: false,
    why: "The shared practice question pool. Carries no player identity.",
  },
  {
    collection: "triviaBatches",
    locators: [],
    strategy: "none",
    exportable: false,
    why: "Generation batch records for the question pool. Carries no player identity.",
  },
  {
    collection: "subcategories",
    locators: [],
    strategy: "none",
    exportable: false,
    why: "The searchable show/league index (entertainment slates). Reference data seeded by the app, not per-user.",
  },
];

/**
 * The uid also appears as a MEMBER of arrays on OTHER users' documents. These are not a collection
 * of their own, so they get their own list — the deleter must scrub them or the deleted account
 * keeps showing up in other people's follow lists.
 */
export const ARRAY_MEMBERSHIPS: { collection: keyof typeof COLLECTIONS; field: string; why: string }[] = [
  {
    collection: "users",
    field: "followedCreators",
    why: "Other players' follow lists. The uid is removed from every one of them.",
  },
];

/** Rules whose records are gathered into the user's data export. */
export function exportableRules(): PersonalDataRule[] {
  return PERSONAL_DATA_MAP.filter((r) => r.exportable);
}

/** Rules the deleter must act on (everything except the "none" classifications). */
export function actionableRules(): PersonalDataRule[] {
  return PERSONAL_DATA_MAP.filter((r) => r.strategy !== "none");
}

/**
 * The plain-language summary shown in the confirm dialog, so the user is told what survives BEFORE
 * they confirm rather than discovering it afterwards. Derived from the map — it cannot drift.
 */
export function retentionSummary(): { kept: string[]; removed: string[] } {
  const kept = PERSONAL_DATA_MAP.filter((r) => r.strategy === "anonymize").map((r) => r.why);
  const removed = PERSONAL_DATA_MAP.filter((r) => r.strategy === "delete").map((r) => r.why);
  return { kept, removed };
}
