import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type EntryDoc } from "@/lib/firebase/types";
import { fetchSlate } from "@/server/data/slates";
import {
  computeShadowEarnings,
  type ShadowEarnings,
} from "@/server/data/shadowEarnings";
import { EmbedSnippet } from "@/components/EmbedSnippet";
import { FollowButton } from "@/components/feed/FollowButton";
import { SlatePicker } from "./SlatePicker";
import { StrategyAdvisor } from "./StrategyAdvisor";

export default async function SlatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const slate = await fetchSlate(adminDb(), id);
  if (!slate) notFound();

  // The user's existing entry for this slate (entry doc id = uid).
  const entrySnap = await adminDb()
    .collection(COLLECTIONS.slates)
    .doc(id)
    .collection(COLLECTIONS.entries)
    .doc(profile.id)
    .get();
  const entryData = entrySnap.exists
    ? (entrySnap.data() as EntryDoc)
    : null;
  const existingEntry = entryData
    ? {
        picks: entryData.picks,
        isPaid: entryData.isPaid,
        score: entryData.score,
        rank: entryData.rank,
        payoutCents: entryData.payoutCents,
        payoutCoins: entryData.payoutCoins,
      }
    : null;

  // Shadow earnings: for a settled FREE entry, what the same card would have won
  // in the smallest paid tier — the free→paid conversion hook.
  let shadowEarnings: ShadowEarnings | null = null;
  if (slate.status === "settled" && entryData && !entryData.isPaid) {
    shadowEarnings = await computeShadowEarnings(
      adminDb(),
      id,
      slate,
      entryData.picks,
      entryData.submittedAt?.toMillis?.() ?? 0,
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Pill tone="accent">{slate.category}</Pill>
          {slate.status === "live" ? (
            <Pill tone="live">Live</Pill>
          ) : (
            <Pill tone="neutral">Locked</Pill>
          )}
        </div>
        <h1 className="text-xl font-semibold leading-snug">{slate.title}</h1>
        {slate.creatorId && slate.creatorId !== profile.id && (
          <div className="mt-2">
            <FollowButton
              creatorId={slate.creatorId}
              initialFollowing={(profile.followedCreators ?? []).includes(
                slate.creatorId,
              )}
            />
          </div>
        )}
      </div>

      {slate.creatorId === profile.id && slate.status === "live" && (
        <Link
          href={`/app/slate/${id}/sell`}
          className="flex items-center justify-between rounded border border-rush-border bg-rush-soft px-4 py-2.5 text-sm font-medium text-rush"
        >
          Sell your picks for this contest
          <span>→</span>
        </Link>
      )}

      {slate.creatorId === profile.id && <EmbedSnippet slateId={id} />}

      {slate.status === "live" && (
        <StrategyAdvisor slateId={id} isPro={profile.proSubscriber} />
      )}

      <SlatePicker
        slate={slate}
        coinBalance={profile.coinBalance}
        cashBalanceCents={profile.cashBalanceCents}
        kycVerified={profile.kycStatus === "verified"}
        registeredState={profile.registeredState}
        existingEntry={existingEntry}
        shadowEarnings={shadowEarnings}
      />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
