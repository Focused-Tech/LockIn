"use server";

import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { SESSION_COOKIE } from "@/lib/firebase/config";
import { buildDataExport, exportFilename } from "@/server/account/export";
import {
  checkDeletionBlockers,
  deleteAccount,
  DeletionBlockedError,
} from "@/server/account/deletion";
import { retentionSummary } from "@/server/account/personalData";
import type { Blocker } from "@/server/account/blockers";

/**
 * SETTINGS — account data actions. These back the two rows that were previously inert stubs:
 * "Download my data" and "Delete account".
 *
 * Every one of them takes its uid from the verified session, never from an argument, so there is no
 * request shape that reaches another account.
 */

export type DeletionStatus = {
  blockers: Blocker[];
  /** What is removed and what is kept, in plain language, derived from the personal-data map. */
  kept: string[];
  removed: string[];
  /** Typing this exactly is required to confirm. */
  confirmPhrase: string;
};

/** Read-only: can this account be deleted right now, and what happens when it is. */
export async function getDeletionStatus(): Promise<DeletionStatus | { error: string }> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { error: "Not signed in" };

  const blockers = await checkDeletionBlockers(profile.id);
  const { kept, removed } = retentionSummary();
  return { blockers, kept, removed, confirmPhrase: profile.username };
}

export type DeleteResult =
  | { ok: true }
  | { ok: false; error: string; blockers?: Blocker[] };

/**
 * Delete the signed-in account for real, then clear the session cookie so the app drops to signed
 * out. `confirmPhrase` must equal the account's username — the server checks it, not just the UI.
 */
export async function deleteMyAccount(confirmPhrase: string): Promise<DeleteResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };

  if (confirmPhrase.trim().toLowerCase() !== profile.username.toLowerCase()) {
    return { ok: false, error: `Type your username (${profile.username}) to confirm.` };
  }

  try {
    await deleteAccount(profile.id);
  } catch (err) {
    if (err instanceof DeletionBlockedError) {
      return {
        ok: false,
        error: "Your account can't be deleted yet.",
        blockers: err.blockers,
      };
    }
    console.error("[account] deletion failed", profile.id, err);
    return { ok: false, error: "Something went wrong. Nothing was deleted — please try again." };
  }

  // The account is gone; drop the cookie so the very next request is unauthenticated.
  (await cookies()).set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return { ok: true };
}

export type ExportResult =
  | { ok: true; filename: string; json: string; sizeBytes: number }
  | { ok: false; error: string };

/**
 * Build the data export and hand it back as a string, so the app can show it and copy it even where
 * a file download isn't available (an in-app webview). The same bytes are served as a real file
 * download by GET /api/account/export.
 */
export async function getMyDataExport(): Promise<ExportResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };

  try {
    const nowIso = new Date().toISOString();
    const data = await buildDataExport(adminDb(), profile.id, nowIso);
    const json = JSON.stringify(data, null, 2);
    return {
      ok: true,
      filename: exportFilename(data.account.username, nowIso),
      json,
      sizeBytes: Buffer.byteLength(json, "utf8"),
    };
  } catch (err) {
    console.error("[account] export failed", profile.id, err);
    return { ok: false, error: "Couldn't build your data file. Please try again." };
  }
}
