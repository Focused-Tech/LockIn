import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { resolveEligibility } from "@/lib/eligibility";
import { ALL_STATES } from "@/lib/eligibility/states";
import type { CreatorGame } from "@/lib/contest/games";
import { getTodaysCreatorGames } from "@/server/feeds/creatorGames";
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

  // §1.1/§1.C — LIVE games from the feed, no seed fallback. A feed failure or an empty board is a
  // VISIBLE error on the builder, never stale games.
  let games: CreatorGame[] = [];
  let feedError: string | null = null;
  try {
    games = await getTodaysCreatorGames();
    if (games.length === 0) feedError = "No games on the board today — the builder needs live games. Check back on a game day.";
  } catch (err) {
    console.error("[creator] live games feed failed", err);
    feedError = "Couldn't load tonight's games from the feed. It's an upstream issue — try again shortly.";
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-serif text-xl text-[#F0C463]">Creator mode</h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Build a slate · Lockpick is watching</p>
      </div>

      <CreatorMode
        games={games}
        feedError={feedError}
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
