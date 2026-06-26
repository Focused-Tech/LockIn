import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { CATEGORIES } from "@/lib/categories";
import { SlateBuilder } from "./SlateBuilder";

export default async function CreatePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Host a contest</h1>
        <p className="text-sm text-muted">
          Build a prediction slate for your audience. AI suggests the odds — you
          decide.
        </p>
      </div>

      <SlateBuilder categories={[...CATEGORIES]} />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
