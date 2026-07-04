import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { ArenaDojo } from "./ArenaDojo";

/**
 * PRACTICE DOJO — single-slate warm-up vs the house AI. Thin auth gate over the
 * ArenaDojo client (category → create AI contest → play).
 */
export default async function DojoPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <ArenaDojo />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
