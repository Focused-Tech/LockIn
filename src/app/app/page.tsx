import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchFeedSlatesCached, filterForClient } from "@/server/data/slates";
import { fetchRecSignals } from "@/server/data/recommendations";
import { isMobileClientUA } from "@/lib/mobileClient";
import { ExploreFeed } from "./ExploreFeed";

export default async function ExplorePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  // Route by persisted lane. Anyone without a lane yet — every new signup, and
  // any existing account predating the journey — is sent to the choose-your-
  // journey picker first (so nobody is stuck on old Explore). Beginner-lane
  // users land on their guided feed; advanced falls through to this Explore.
  if (!profile.journeyLane) redirect("/app/choose");
  if (profile.journeyLane === "beginner") redirect("/app/beginner");

  const isMobile = isMobileClientUA((await headers()).get("user-agent"));
  const [allSlates, signals] = await Promise.all([
    fetchFeedSlatesCached(),
    fetchRecSignals(adminDb(), profile.id, profile.followedCreators ?? []),
  ]);
  const slates = filterForClient(allSlates, { blockCashEntertainment: isMobile });

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-3">
        {/* Header spans the full width on its own line so the description wraps
            normally and never gets crushed by the action pills. */}
        <div>
          <h1 className="text-xl font-semibold">The Floor</h1>
          <p className="text-sm text-muted">
            Every contest live right now. Call the night, climb the board.
          </p>
        </div>
        {/* Packages pill removed (Frank's call) — the marketplace lives on the
            slate/creator surfaces, not the Floor header. */}
      </div>

      <ExploreFeed initialSlates={slates} signals={signals} />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
