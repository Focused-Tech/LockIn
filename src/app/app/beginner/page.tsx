import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchBeginnerFeed } from "@/server/data/beginner";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { BeginnerJourney } from "./BeginnerJourney";

/** Beginner-lane Explore + guided play loop (reads real slate data). */
export default async function BeginnerPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const feed = await fetchBeginnerFeed(
    adminDb(),
    profile.followedCreators ?? [],
  );

  return (
    <div className="flex flex-col gap-5 p-6">
      <BeginnerJourney
        feed={feed}
        coinBalance={profile.coinBalance ?? 0}
      />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
