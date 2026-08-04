"use server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type CreatorSignatureDoc } from "@/lib/firebase/types";
import {
  AGREEMENT_VERSION,
  SECTION_KEYS,
  type SectionKey,
} from "@/lib/creator/agreement";

export type SignResult =
  | { ok: true; signed: SectionKey[]; onboarded: boolean }
  | { ok: false; error: string };

/**
 * Sign ONE section of the creator agreement. Called on Continue, per section — so an
 * abandoned flow keeps the sections already signed and resumes at the next unsigned one.
 * Each signature is its own append-only doc (id = version_section, idempotent per version;
 * a version bump writes NEW docs and keeps the old). When all sections of the current
 * version are signed, the creator-onboarded flag flips true and the gate opens.
 */
export async function signCreatorSection(section: SectionKey): Promise<SignResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  if (!profile.creatorVerified) return { ok: false, error: "Not a verified creator" };
  if (!SECTION_KEYS.includes(section)) return { ok: false, error: "Unknown section" };

  const db = adminDb();
  const userRef = db.collection(COLLECTIONS.users).doc(profile.id);
  const sigsRef = userRef.collection(COLLECTIONS.creatorSignatures);

  // Write this section's signature (idempotent per version+section).
  const sig: CreatorSignatureDoc = {
    section,
    version: AGREEMENT_VERSION,
    signedAt: FieldValue.serverTimestamp() as never,
  };
  await sigsRef.doc(`${AGREEMENT_VERSION}_${section}`).set(sig);

  // Which sections of the CURRENT version are now signed?
  const snap = await sigsRef.get();
  const signed = snap.docs
    .map((d) => d.data() as CreatorSignatureDoc)
    .filter((s) => s.version === AGREEMENT_VERSION)
    .map((s) => s.section as SectionKey);
  const complete = SECTION_KEYS.every((k) => signed.includes(k));

  if (complete) {
    await userRef.set(
      { creatorOnboarded: true, creatorAgreementVersion: AGREEMENT_VERSION, isCreator: true },
      { merge: true },
    );
  }

  return { ok: true, signed, onboarded: complete };
}
