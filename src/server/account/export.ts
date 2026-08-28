import "server-only";
import { Timestamp, type Firestore, type Query } from "firebase-admin/firestore";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { PERSONAL_DATA_MAP, exportableRules } from "./personalData";

/**
 * DATA EXPORT — everything we hold about one account, in one JSON file.
 *
 * Scope is drawn from the same map the deleter uses, so the two can't drift: if a collection holds
 * this user's personal data, it is either in the export or explicitly marked non-exportable with a
 * reason (moderation ledgers are the only ones, because exporting them would reveal who reported
 * whom — that is someone else's data, not this user's).
 *
 * Only ever the requesting user's own records. Nothing here takes a uid from the client.
 */

export const EXPORT_FORMAT = "lockin-data-export/1" as const;

export interface DataExport {
  format: typeof EXPORT_FORMAT;
  generatedAt: string;
  account: { uid: string; username: string | null };
  /** Human-readable note that ships inside the file. */
  notes: string[];
  profile: Record<string, unknown> | null;
  /** Collection name → this user's documents in it. */
  records: Record<string, { id: string; path: string; data: Record<string, unknown> }[]>;
  /** Collections that hold data about this user but are deliberately not exported, and why. */
  withheld: { collection: string; reason: string }[];
}

/** Firestore values → JSON-safe values. Timestamps become ISO strings; everything else recurses. */
function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    // Firestore refs and other exotics: fall back to a readable path/string rather than {}.
    const maybeRef = value as { path?: unknown; _path?: unknown };
    if (typeof maybeRef.path === "string" && !("toDate" in (value as object))) {
      return maybeRef.path;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toPlain(v);
    }
    return out;
  }
  return value;
}

/** What replaces another player's account id or handle in an exported record. */
export const REDACTED = "[another account]";

/**
 * Blank the counterparty's identifier on a shared record. A referral, an enrolment key and a
 * placement request each have two sides: the requesting user is entitled to their own row, not to
 * the other person's account id. Values that ARE the requesting user are left alone.
 */
function redact(
  data: Record<string, unknown>,
  fields: string[] | undefined,
  self: { uid: string; username: string | null },
): Record<string, unknown> {
  if (!fields || fields.length === 0) return data;
  const out = { ...data };
  const mine = new Set(
    [self.uid, self.username?.toLowerCase()].filter((v): v is string => typeof v === "string"),
  );
  for (const f of fields) {
    const v = out[f];
    if (typeof v !== "string" || v.length === 0) continue;
    if (mine.has(v) || mine.has(v.toLowerCase())) continue;
    out[f] = REDACTED;
  }
  return out;
}

const plainDoc = (
  d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  redactFields: string[] | undefined,
  self: { uid: string; username: string | null },
) => ({
  id: d.id,
  path: d.ref.path,
  data: redact(toPlain(d.data() ?? {}) as Record<string, unknown>, redactFields, self),
});

/**
 * Gather the export. `nowIso` is injected so the caller controls the timestamp (and tests are
 * deterministic).
 */
export async function buildDataExport(
  db: Firestore,
  uid: string,
  nowIso: string,
): Promise<DataExport> {
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const userSnap = await userRef.get();
  const profile = userSnap.exists ? (userSnap.data() as UserDoc) : null;

  const records: DataExport["records"] = {};
  const withheld: DataExport["withheld"] = [];

  const push = (name: string, docs: { id: string; path: string; data: Record<string, unknown> }[]) => {
    if (docs.length === 0) return;
    records[name] = [...(records[name] ?? []), ...docs];
  };

  const self = { uid, username: profile?.username ?? null };

  for (const rule of exportableRules()) {
    const name = COLLECTIONS[rule.collection];
    if (rule.collection === "users") continue; // the profile has its own slot
    const asPlain = (d: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) =>
      plainDoc(d, rule.redactFields, self);

    for (const loc of rule.locators) {
      if (loc.kind === "subcollection") {
        const snap = await userRef.collection(name).get();
        push(name, snap.docs.map(asPlain));
        continue;
      }
      if (loc.kind === "docId") {
        const snap = await db.collection(name).doc(uid).get();
        if (snap.exists) push(name, [asPlain(snap)]);
        continue;
      }
      if (loc.kind === "docIdOther") continue; // the username reservation is not user content
      if (loc.kind === "field") {
        const base: Query = loc.group === true ? db.collectionGroup(name) : db.collection(name);
        const snap = await base.where(loc.field, "==", uid).get();
        push(name, snap.docs.map(asPlain));
      }
    }
  }

  // De-duplicate: a rule with two field locators (e.g. keyholderEvents) can match the same doc twice.
  for (const [name, docs] of Object.entries(records)) {
    const seen = new Set<string>();
    records[name] = docs.filter((d) => (seen.has(d.path) ? false : (seen.add(d.path), true)));
  }

  // Collections that hold this user's data but are deliberately excluded — named in the file itself
  // so the export is honest about its own boundary rather than silently omitting things.
  for (const rule of PERSONAL_DATA_MAP) {
    if (!rule.exportable && rule.strategy !== "none") {
      withheld.push({ collection: COLLECTIONS[rule.collection], reason: rule.why });
    }
  }

  return {
    format: EXPORT_FORMAT,
    generatedAt: nowIso,
    account: { uid, username: profile?.username ?? null },
    notes: [
      "This file contains the data Lock In holds about your account.",
      "Timestamps are ISO 8601 in UTC. Money is in cents.",
      "Records belonging to other players are not included, even where they appear alongside yours.",
    ],
    profile: profile
      ? redact(
          toPlain(profile) as Record<string, unknown>,
          PERSONAL_DATA_MAP.find((r) => r.collection === "users")?.redactFields,
          self,
        )
      : null,
    records,
    withheld,
  };
}

/** Suggested filename for the download. */
export function exportFilename(username: string | null, nowIso: string): string {
  const stamp = nowIso.slice(0, 10);
  const who = (username ?? "account").replace(/[^a-zA-Z0-9_-]/g, "");
  return `lockin-data-${who}-${stamp}.json`;
}
