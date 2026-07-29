import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { resolveEligibility } from "@/lib/eligibility";
import { ALL_STATES } from "@/lib/eligibility/states";
import { TONIGHTS_GAMES } from "@/lib/contest/games";
import { CreatorMode } from "./CreatorMode";

/**
 * Creator Engine slice 4 — the slate builder ("Creator mode · Lockpick is watching").
 * Built to design/lockin_creator_mode_mockup.html. Games → questions (Lockpick-validated) → the pot.
 */
export default async function CreatorModePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");

  const state = profile.registeredState ?? profile.geoState ?? null;
  const elig = resolveEligibility(state);
  // Reach = states where a player can enter this slate for CASH (coins reach everywhere).
  const cashReach = ALL_STATES.filter((s) => resolveEligibility(s).canPlayCash).length;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-serif text-xl text-[#F0C463]">Creator mode</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Build a slate · Lockpick is watching</p>
      </div>

      <CreatorMode
        games={TONIGHTS_GAMES}
        formatTier={elig.formatTier}
        cashReach={cashReach}
        totalStates={ALL_STATES.length}
        canHostCash={elig.canHostCash}
        cashBlockReason={elig.cashBlockReason}
      />

      <SkillGameDisclaimer className="mt-2" />
    </div>
  );
}
