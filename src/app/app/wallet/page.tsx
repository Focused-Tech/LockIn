import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchTransactions } from "@/server/data/wallet";
import { isSelfExcluded } from "@/server/data/responsiblePlay";
import { WalletView } from "./WalletView";
import "../lk-panels.css";

export default async function WalletPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";
  const transactions = await fetchTransactions(adminDb(), profile.id);
  const selfExcluded = isSelfExcluded(profile);

  return (
    <>
      {selfExcluded && (
        <div className="lk-acct px-4 pt-4">
          <div className="blk warn">
            <b className="block text-[15px] font-semibold text-white">Account self-excluded</b>
            <p className="hint mt-1.5">Deposits and play are paused.</p>
          </div>
        </div>
      )}
      <WalletView
        uid={profile.id}
        advanced={advanced}
        coinBalance={profile.coinBalance}
        cashBalanceCents={profile.cashBalanceCents}
        kycVerified={profile.kycStatus === "verified"}
        transactions={transactions}
      />
    </>
  );
}
