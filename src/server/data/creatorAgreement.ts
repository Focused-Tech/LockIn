import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type CreatorSignatureDoc } from "@/lib/firebase/types";
import { AGREEMENT_VERSION, type SectionKey } from "@/lib/creator/agreement";

// The gate check is pure + client-safe (lib/creator/agreement); re-exported so the route
// handlers keep importing it from the server data module alongside fetchSignedSections.
export { isCreatorOnboarded } from "@/lib/creator/agreement";

/** Which sections the creator has already signed for `version` — drives resume. */
export async function fetchSignedSections(
  db: Firestore,
  uid: string,
  version: string = AGREEMENT_VERSION,
): Promise<SectionKey[]> {
  const snap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.creatorSignatures)
    .get();
  const signed: SectionKey[] = [];
  for (const d of snap.docs) {
    const sig = d.data() as CreatorSignatureDoc;
    if (sig.version === version) signed.push(sig.section as SectionKey);
  }
  return signed;
}
