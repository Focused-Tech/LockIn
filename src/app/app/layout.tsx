import { ChatAssistant } from "@/components/ChatAssistant";
import { AppFrame } from "@/components/app/AppFrame";
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
      {/* The old GuidedTour walkthrough is intentionally NOT mounted. It rendered
          a full-screen pointer-capturing overlay on /app (its "welcome" step has
          no target → a centered modal) that trapped lane-having users on Explore:
          every tap hit the backdrop, so Beginner/Creator/etc. were unreachable.
          It's obsolete — the beginner journey teaches first-pick in context and
          the advanced journey is the full market. Removed rather than re-gated. */}
    </CrossParlayProvider>
  );
}
