import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { fetchReferralDashboard } from "@/server/data/referrals";
import { ReferralView } from "./ReferralView";

export default async function ReferPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const data = await fetchReferralDashboard(adminDb(), uid);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Invite &amp; earn</h1>
        <p className="text-sm text-muted">
          Share LockIn with friends and earn coins and cash.
        </p>
      </div>

      <ReferralView data={data} />
    </div>
  );
}
