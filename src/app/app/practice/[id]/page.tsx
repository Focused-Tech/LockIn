import { notFound, redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchPracticeContest } from "@/server/data/practice";
import { rankForCoins } from "@/lib/practice/tiers";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
import { isBusted, PRACTICE_START_COINS } from "@/lib/practice/scoring";
import { PracticeContest } from "./PracticeContest";

export default async function PracticeContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const view = await fetchPracticeContest(adminDb(), id, profile.id);
  if (!view) notFound();

  const rank = rankForCoins(profile.practiceLifetimeCoins ?? 0);
  // Funnel nudge is earned + rare: Pro tier or higher, OR on a strong streak.
  const funnelEligible =
    rank.index >= PRACTICE_CONFIG.nudge.minTierIndex ||
    (profile.practiceStreak ?? 0) >= PRACTICE_CONFIG.nudge.streakAt;

  // Busted players can still browse + see the leaderboard — just not stake until
  // their daily refill. (If the cooldown has elapsed, submit auto-claims.)
  const coins = profile.practiceCoins ?? PRACTICE_START_COINS;
  const refillAt = profile.practiceRefillAt ?? null;
  const canStake =
    !isBusted(coins) || (refillAt != null && Date.now() >= refillAt);

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <PracticeContest
        view={view}
        isHost={view.hostUsername === profile.username}
        funnelEligible={funnelEligible}
        canStake={canStake}
        refillAt={refillAt}
      />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
