import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { CATEGORIES } from "@/lib/categories";
import {
  difficultyForTier,
  rankForCoins,
  type PracticeTierKey,
} from "@/lib/practice/tiers";
import { CreatePracticeForm } from "./CreatePracticeForm";

export default async function CreatePracticePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const rank = rankForCoins(profile.practiceLifetimeCoins ?? 0);
  const difficulty = difficultyForTier(rank.tier.key as PracticeTierKey);

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Host a practice contest</h1>
        <p className="text-sm text-muted">
          Build a slate for your friends. Everyone stakes practice coins (score)
          — no real money, ever. Scaled to your <b>{rank.tier.label}</b> tier:{" "}
          {difficulty.legs} legs.
        </p>
      </div>
      <CreatePracticeForm
        categories={[...CATEGORIES]}
        tierLabel={rank.tier.label}
        legs={difficulty.legs}
      />
    </div>
  );
}
