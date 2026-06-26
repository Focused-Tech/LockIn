import { ChatAssistant } from "@/components/ChatAssistant";
import { AppFrame } from "@/components/app/AppFrame";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { CrossParlayProvider } from "@/components/cross-parlay/CrossParlayProvider";
import { CrossParlayBuilder } from "@/components/cross-parlay/CrossParlayBuilder";
import { NativeBridge } from "@/components/notifications/NativeBridge";
import { getCurrentUserProfile } from "@/lib/firebase/session";

/**
 * All authenticated app screens render inside the mobile {@link AppFrame} (phone
 * top-nav + bottom tab bar + scrolling content). The desktop SaaS navbar
 * (`DesktopNav`) is intentionally NOT mounted here — it's retained in the repo
 * for the future desktop creator portal only. Chat + parlay cart render as
 * overlays inside the frame; the onboarding tour stays a viewport-level overlay
 * so its element spotlight stays aligned.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  // Unauthenticated: pages redirect to /login themselves; render children bare
  // (no profile → no frame chrome) to avoid a flash of empty nav.
  if (!profile) {
    return (
      <CrossParlayProvider>
        {children}
        <NativeBridge />
      </CrossParlayProvider>
    );
  }

  return (
    <CrossParlayProvider>
      <AppFrame
        username={profile.username}
        coinBalance={profile.coinBalance}
        cashBalanceCents={profile.cashBalanceCents}
        overlays={
          <>
            <ChatAssistant />
            <CrossParlayBuilder />
          </>
        }
      >
        {children}
      </AppFrame>
      <NativeBridge />
      {/* The guided first-pick tour belongs to users who have chosen a lane.
          Gating on journeyLane keeps it out of the render path for lane-less
          new signups — otherwise its "welcome / make your first pick" step
          (which matches pathname === "/app") flashes for a frame during the
          server redirect bounce from /app to the journey picker (/app/choose). */}
      {profile.journeyLane && !profile.hasCompletedTour && (
        <GuidedTour initialStep={profile.currentTourStep ?? 0} />
      )}
    </CrossParlayProvider>
  );
}
