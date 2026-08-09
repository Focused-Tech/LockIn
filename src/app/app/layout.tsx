import { ChatAssistant } from "@/components/ChatAssistant";
import { AppFrame } from "@/components/app/AppFrame";
import { CrossParlayProvider } from "@/components/cross-parlay/CrossParlayProvider";
import { NativeBridge } from "@/components/notifications/NativeBridge";
import { TutorialLauncher } from "@/components/app/TutorialLauncher";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { getTutorialRecord } from "@/app/app/tutorial/actions";
import { laneToTutorialMode, isTutorialSeen } from "@/lib/tutorial/tutorials";

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

  // §4 — the tutorial fires once after onboarding, for the mode the user selected (their journey
  // lane). Only offered to onboarded users (a lane is set); the seen-record (version-aware) gates it.
  const tutorialMode = laneToTutorialMode(profile.journeyLane);
  const tutorialSeen = profile.journeyLane
    ? isTutorialSeen(await getTutorialRecord(tutorialMode))
    : true;

  return (
    <CrossParlayProvider>
      <AppFrame
        username={profile.username}
        isKeyholder={profile.keyholder === true}
        isKeymaster={profile.keymaster === true}
        isAdmin={profile.isAdmin === true}
        overlays={
          <>
            {/* COMPLIANCE — the Cross-Parlay Builder FAB is removed: "parlay" is a gambling term and
                a compliance issue. The context provider stays (consumers reference it); the visible
                bottom-left launcher is gone. */}
            <ChatAssistant />
            {profile.journeyLane && (
              <TutorialLauncher mode={tutorialMode} initialSeen={tutorialSeen} />
            )}
          </>
        }
      >
        {children}
      </AppFrame>
      <NativeBridge />
    </CrossParlayProvider>
  );
}
