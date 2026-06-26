import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchFeedSlates } from "@/server/data/slates";
import { fetchRecSignals } from "@/server/data/recommendations";
import { ExploreFeed } from "./ExploreFeed";

export default async function ExplorePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  // Respect the persisted lane: beginner-lane users land on their guided feed.
  // (Switching to Advanced from the beginner toggle sets the lane, so this
  // won't loop.) Users predating the journey default to this advanced feed.
  if (profile.journeyLane === "beginner") redirect("/app/beginner");

  const [slates, signals] = await Promise.all([
    fetchFeedSlates(adminDb()),
    fetchRecSignals(adminDb(), profile.id, profile.followedCreators ?? []),
  ]);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Explore</h1>
          <p className="text-sm text-muted">
            Live contests from creators. Pick outcomes, climb the board.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/app/beginner"
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
          >
            Beginner
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
