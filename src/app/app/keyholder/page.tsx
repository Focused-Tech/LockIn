import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchKeyholderPipeline } from "@/server/data/keyholderPipeline";
import { KeyholderPortal } from "./KeyholderPortal";
import { RequestPlacementCard } from "./RequestPlacementCard";
import { myPlacementRequest } from "./actions";
import "../lk-panels.css";

/**
 * KEYHOLDER PORTAL — role-gated. A non-keyholder gets a hard 404 (notFound), NOT a locked page:
 * the route does not exist for them. Server-rendered; the portal reads only the keyholder's own
 * referrals + projected earnings (no house margins — see fetchKeyholderPortal).
 */
export default async function KeyholderPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.keyholder) notFound();

  const pipeline = await fetchKeyholderPipeline(adminDb(), profile.id);

  // A keyholder with NO upline can request placement in a keymaster's downline (their only tree
  // action). Placed keyholders don't see it (placement is once).
  const needsPlacement = !profile.keymasterUid;
  const request = needsPlacement ? await myPlacementRequest() : null;

  return (
    <>
      {needsPlacement && (
        <div className="lk-acct px-4 pt-4">
          <RequestPlacementCard initial={request} />
        </div>
      )}
      <KeyholderPortal pipeline={pipeline} />
    </>
  );
}

