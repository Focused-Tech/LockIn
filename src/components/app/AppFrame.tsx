import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { ScrollReset } from "./ScrollReset";

/**
 * Phone-shaped app shell. The mobile experience is the product at every viewport
 * width: a ~430px (iPhone 14 Pro) column, centered with neutral surrounding
 * space and a rounded device border on screens wider than the phone. On a real
 * phone / installed PWA the column simply fills the viewport.
 *
 * Structure mirrors the design mockups: a fixed {@link TopNav}, a single
 * scrolling content area, and a fixed {@link BottomNav}. `overlays` (chat, parlay
 * cart, etc.) render inside the shell, which is a containing block (`contain:
 * layout`) so their fixed positioning anchors to the phone, not the viewport.
 *
 * Future "switch to desktop" is a one-line change: flip {@link PHONE_FRAME}.
 */
const PHONE_FRAME = true;

const frameClasses = PHONE_FRAME
  ? "max-w-[430px] min-[480px]:my-4 min-[480px]:h-[860px] min-[480px]:max-h-[calc(100dvh-2rem)] min-[480px]:rounded-[36px] min-[480px]:border-2 min-[480px]:border-border"
  : "max-w-none";

export function AppFrame({
  children,
  overlays,
  username,
  isKeyholder = false,
  isKeymaster = false,
  isAdmin = false,
}: {
  children: React.ReactNode;
  overlays?: React.ReactNode;
  username: string;
  isKeyholder?: boolean;
  isKeymaster?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[#08090c] min-[480px]:items-center">
      <div
        className={
          "relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background [contain:layout] " +
          frameClasses
        }
      >
        <TopNav username={username} isKeyholder={isKeyholder} isKeymaster={isKeymaster} isAdmin={isAdmin} />
        <ScrollReset />
        <main id="app-scroll" className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
        <BottomNav />
        {overlays}
      </div>
    </div>
  );
}
