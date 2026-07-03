import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { ArenaSession } from "./ArenaSession";

/**
 * ARENA — the multi-slate practice round. Additive to the single-slate flow; the
 * whole round is orchestrated client-side (ArenaSession) over the existing
 * practice server actions, so this page is a thin auth gate + shell.
 */
export default async function ArenaPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter flex flex-col gap-5 p-6">
      <ArenaSession />
      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
