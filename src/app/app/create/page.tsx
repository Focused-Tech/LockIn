import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { isCreatorOnboarded } from "@/server/data/creatorAgreement";
import { CATEGORIES } from "@/lib/categories";
import { SlateBuilder } from "./SlateBuilder";

export default async function CreatePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");
  // The gate lives on the ROUTE (deep-link-proof): a verified creator who has not fully
  // signed the current Creator Agreement is sent to the acknowledgment flow, not the builder.
  if (!isCreatorOnboarded(profile)) redirect("/app/creator/agreement");

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Host a contest</h1>
        <p className="text-sm text-muted">
          Build a prediction slate for your audience. AI suggests the odds — you
          decide.
        </p>
      </div>

      {/* Creator Engine slice 4 — the new cross-game builder with Lockpick + the pot. */}
      <Link
        href="/app/creator"
        className="flex items-center justify-between rounded-xl border p-4"
        style={{ borderColor: "#A86F2D", background: "linear-gradient(180deg, rgba(252,62,1,.10), rgba(168,111,45,.06))" }}
      >
        <span>
          <span className="block font-serif text-base text-[#F0C463]">Creator mode · new</span>
          <span className="block text-sm text-muted">Cross-game slates, Lockpick validation, live pot projection.</span>
        </span>
        <span className="text-[#FC3E01]">›</span>
      </Link>

      <SlateBuilder categories={[...CATEGORIES]} />

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
