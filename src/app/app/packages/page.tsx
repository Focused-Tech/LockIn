import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  fetchMarketplace,
  type MarketPackage,
  type OwnedPackage,
} from "@/server/data/packages";
import { formatCents } from "@/lib/utils";
import { BuyButton } from "./BuyButton";

export default async function PackagesPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const { available, owned } = await fetchMarketplace(adminDb(), uid);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Pick packages</h1>
        <p className="text-sm text-muted">
          Buy a creator&apos;s picks to inform your own card.
        </p>
      </div>

      {/* Available */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Available</h2>
        {available.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">
            No packages for sale right now.
          </Card>
        ) : (
          available.map((p) => <AvailableCard key={p.id} pkg={p} />)
        )}
      </section>

      {/* Owned / created */}
      {owned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Your packages</h2>
          {owned.map((p) => (
            <OwnedCard key={p.id} pkg={p} />
          ))}
        </section>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}

function AvailableCard({ pkg }: { pkg: MarketPackage }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{pkg.name}</p>
        <p className="truncate text-xs text-muted">
          {pkg.slateTitle} · @{pkg.creatorName}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Pill tone="accent">{pkg.category}</Pill>
          {pkg.earlyBirdActive && <Pill tone="rush">Early bird</Pill>}
          <span className="text-xs text-muted">{pkg.purchasesCount} sold</span>
        </div>
      </div>
      <BuyButton
        packageId={pkg.id}
        priceCents={pkg.effectivePriceCents}
        coinPrice={pkg.coinPrice}
      />
    </Card>
  );
}

function OwnedCard({ pkg }: { pkg: OwnedPackage }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{pkg.name}</p>
        <Pill tone={pkg.isOwnedByYou ? "rush" : "win"}>
          {pkg.isOwnedByYou ? "Your package" : "Purchased"}
        </Pill>
      </div>
      <p className="text-xs text-muted">
        {pkg.slateTitle} · {formatCents(pkg.priceCents)} ·{" "}
        {pkg.purchasesCount} sold
      </p>
      <ul className="mt-1 flex flex-col gap-1.5">
        {pkg.picks.map((pick, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-sm"
          >
            <span className="truncate text-muted">{pick.question}</span>
            <span className="ml-2 shrink-0 font-medium text-accent">
              {pick.choiceLabel}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
