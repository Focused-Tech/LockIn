import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { COLLECTIONS, type EntryDoc } from "@/lib/firebase/types";
import { fetchSlate } from "@/server/data/slates";
import {
  computeShadowEarnings,
  type ShadowEarnings,
} from "@/server/data/shadowEarnings";
import { EmbedSnippet } from "@/components/EmbedSnippet";
import { ShareCardPanel } from "@/components/ShareCardPanel";
import { FollowButton } from "@/components/feed/FollowButton";
import { getDemoSlate } from "@/lib/demoSlates";
import { SlatePicker } from "./SlatePicker";

export default async function SlatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  // DEMO slate — free, pinned tester contest. No Firestore, no entry lookup, no creator panels;
  // the picker runs the pick → lock-in flow locally (isDemo) without moving money.
  const demoSlate = getDemoSlate(id);
  if (demoSlate) {
    return (
      <div className="flex flex-col gap-5 p-6">
        <Link
          href="/app"
          className="flex items-center gap-1 self-start text-sm font-semibold text-muted"
        >
          ‹ Back to The Floor
        </Link>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Pill tone="accent">{demoSlate.category}</Pill>
            <Pill tone="live">Demo</Pill>
          </div>
          <h1 className="text-xl font-semibold leading-snug">{demoSlate.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Free to play through — pick every leg and lock in to see the flow. Nothing leaves your
            balance.
          </p>
        </div>
        <SlatePicker
          slate={demoSlate}
          cashBalanceCents={profile.cashBalanceCents}
          cashAttested
          registeredState={profile.registeredState}
          existingEntry={null}
          shadowEarnings={null}
          isDemo
        />
        <SkillGameDisclaimer className="mt-auto pt-4" />
      </div>
    );
  }

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
      <Link
        href="/app"
        className="flex items-center gap-1 self-start text-sm font-semibold text-muted"
      >
        ‹ Back to The Floor
      </Link>
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

      {slate.creatorId === profile.id && <ShareCardPanel slateId={id} />}

      {/* COMPLIANCE — a withheld slate (banned archetype) is never playable: no advisor, no picker,
          no banned leg text. It shows a visible under-review state instead. */}
      {slate.withheld ? (
        <Card className="flex flex-col gap-1.5" data-withheld>
          <p className="text-sm font-semibold">Under review</p>
          <p className="text-xs text-muted">
            This contest is under review and isn&apos;t available to play.
          </p>
        </Card>
      ) : (
        <>
          {/* §1.1 — the pro-upsell advisor block is removed here: there is no Pro subscription, so it
              advertised a product that doesn't exist. */}
          <SlatePicker
            slate={slate}
            cashBalanceCents={profile.cashBalanceCents}
            cashAttested={!!profile.cashAttestation}
            registeredState={profile.registeredState}
            existingEntry={existingEntry}
            shadowEarnings={shadowEarnings}
          />
        </>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
