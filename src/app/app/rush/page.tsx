import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { SlateCard } from "@/components/feed/SlateCard";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchFeedSlates } from "@/server/data/slates";

/**
 * Rush tab — a placeholder destination for the bottom nav while the dedicated
 * Card Rush screen is built later. Intentionally the thinnest possible view over
 * existing data: the standard feed query, filtered to Card Rush slates and
 * rendered with the existing {@link SlateCard}. No new components or data
 * fetches. Defaults to the $5 tier for display (same as the Explore default).
 */
export default async function RushPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const slates = (await fetchFeedSlates(adminDb())).filter((s) => s.isCardRush);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">
          <span className="text-rush">Card</span> Rush
        </h1>
        <p className="text-sm text-muted">
          Boosted contests. Bigger prizes. Limited windows.
        </p>
      </div>

      {slates.length === 0 ? (
        <div className="rounded border border-border bg-surface-card p-8 text-center text-sm text-muted">
          No Card Rush live right now. Check back soon.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slates.map((slate) => (
            <Link key={slate.id} href={`/app/slate/${slate.id}`} className="block">
              <SlateCard slate={slate} tier={5} free={false} />
            </Link>
          ))}
        </div>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
