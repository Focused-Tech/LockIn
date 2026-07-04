import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { ArenaSession } from "../ArenaSession";

/**
 * MULTI-SLATE — queue several slates and play them back-to-back vs AI creators.
 * This is the existing ArenaSession flow (categories → slates → play → reveal),
 * rehomed to its own sub-route so the chooser owns /app/practice/arena. Back /
 * reveal-exit return to the chooser.
 */
export default async function MultiSlatePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <ArenaSession />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
