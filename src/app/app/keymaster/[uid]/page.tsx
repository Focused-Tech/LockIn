import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { fetchKeyholderPipeline } from "@/server/data/keyholderPipeline";
import { KeyholderPortal } from "@/app/app/keyholder/KeyholderPortal";
import "../../lk-panels.css";

/**
 * KEYMASTER DRILL-IN (Part 5 J) — read-only view of a keyholder in the CALLER's own downline, same
 * pattern as the admin performance view, with a banner naming whose data it is. 404 unless the caller
 * is a keymaster and the target is in their tree.
 */
export default async function KeymasterDrillIn({ params }: { params: Promise<{ uid: string }> }) {
  const me = await getCurrentUserProfile();
  if (!me) redirect("/login");
  if (!me.keymaster) notFound();
  const { uid } = await params;

  const targetSnap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  const target = targetSnap.data() as UserDoc | undefined;
  if (!target || target.keymasterUid !== me.id) notFound(); // only MY downline

  const pipeline = await fetchKeyholderPipeline(adminDb(), uid);
  return (
    <div>
      <KeyholderPortal pipeline={pipeline} hideHeader bannerName={target.username} />
    </div>
  );
}
