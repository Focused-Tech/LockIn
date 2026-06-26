import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchTransactions } from "@/server/data/wallet";
import { isSelfExcluded } from "@/server/data/responsiblePlay";
import { WalletView } from "./WalletView";

export default async function WalletPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const transactions = await fetchTransactions(adminDb(), profile.id);
  const selfExcluded = isSelfExcluded(profile);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Wallet</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/app/pro"
            className="text-sm font-medium text-ai hover:opacity-80"
          >
            Pro
          </Link>
          <Link
            href="/app/refer"
            className="text-sm text-muted hover:text-foreground"
          >
            Invite
          </Link>
          <Link
            href="/app/responsible-play"
            className="text-sm text-muted hover:text-foreground"
          >
            Responsible play
          </Link>
        </div>
      </div>

      {selfExcluded && (
        <div className="rounded border border-accent-border bg-accent-soft px-4 py-3 text-sm text-accent">
          Your account is self-excluded — deposits and play are paused.
        </div>
      )}

      <WalletView
        uid={profile.id}
        coinBalance={profile.coinBalance}
        cashBalanceCents={profile.cashBalanceCents}
        kycVerified={profile.kycStatus === "verified"}
        transactions={transactions}
      />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
