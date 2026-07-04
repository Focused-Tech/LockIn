import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchFeedSlatesCached } from "@/server/data/slates";
import { fetchRecSignals } from "@/server/data/recommendations";
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

  const [slates, signals] = await Promise.all([
    fetchFeedSlatesCached(),
    fetchRecSignals(adminDb(), profile.id, profile.followedCreators ?? []),
  ]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-3">
        {/* Header spans the full width on its own line so the description wraps
            normally and never gets crushed by the action pills. */}
        <div>
          <h1 className="text-xl font-semibold">Explore</h1>
          <p className="text-sm text-muted">
            Live contests from creators. Pick outcomes, climb the board.
          </p>
        </div>
        {/* Action pills on their own row below (wraps like the category-pill row,
            so nothing clips at 390–430px). */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/app/choose"
            className="rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
          >
            Switch journey
          </Link>
          <Link
            href="/app/packages"
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
          >
            Packages
          </Link>
          <Link
            href="/app/create"
            className="rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
          >
            + Host
          </Link>
        </div>
      </div>

      <ExploreFeed initialSlates={slates} signals={signals} />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
