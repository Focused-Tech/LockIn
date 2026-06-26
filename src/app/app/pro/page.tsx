import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchUserChatContext } from "@/server/data/userStats";
import { CategoryPerformance } from "./CategoryPerformance";
import { ProView } from "./ProView";

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const { status } = await searchParams;

  const categoryStats = profile.proSubscriber
    ? (await fetchUserChatContext(adminDb(), profile.id, {
        includeCategoryStats: true,
      })).categoryStats ?? []
    : null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Go Pro</h1>
        <p className="text-sm text-muted">
          Unlock the AI Strategy Advisor and more.
        </p>
      </div>

      <ProView
        isPro={profile.proSubscriber}
        expiresMs={profile.proExpiresAt?.toMillis?.() ?? 0}
        justSubscribed={status === "success"}
      />

      {categoryStats !== null && <CategoryPerformance stats={categoryStats} />}
    </div>
  );
}
