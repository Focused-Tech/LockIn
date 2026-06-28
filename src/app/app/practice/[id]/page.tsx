import { notFound, redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchPracticeContest } from "@/server/data/practice";
import { rankForCoins } from "@/lib/practice/tiers";
import { PRACTICE_CONFIG } from "@/lib/practice/config";
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

  return (
    <div className="flex flex-col gap-5 p-6">
      <PracticeContest
        view={view}
        isHost={view.hostUsername === profile.username}
        funnelEligible={funnelEligible}
      />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
