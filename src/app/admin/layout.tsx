import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app/AppFrame";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { isWeb } from "@/lib/surface";
import "../start/start.css";

/**
 * ADMIN SHELL — two shells, one per surface.
 *
 * THE BUG THIS FIXES: admin rendered inside {@link AppFrame} — the 430px phone shell, which brings
 * its own TopNav — and a fixed-position "← Lock In" chip was laid on top of it. At desktop width
 * that produced two headers stacked in the same corner: the chip over the wordmark, "Admin"
 * colliding with "Applications". The cause was a web page nested in the app shell, so the fix is the
 * NESTING, not a z-index: on the web surface admin no longer mounts AppFrame at all, and the back
 * link sits in normal flow inside a real web header instead of floating over one.
 *
 * MOBILE IS UNCHANGED — the binary still gets AppFrame exactly as before.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  if (isWeb()) {
    return (
      <div className="lk-web">
        <header className="lk-web-header">
          <div className="lk-web-shell lk-web-headrow">
            <Link href="/" className="lk-web-brand" aria-label="Lock In — home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wordmark-lockin.png" alt="Lock In" height={26} />
            </Link>
            <nav className="lk-web-nav" aria-label="Admin">
              <Link href="/admin" className="lk-web-navlink">
                Overview
              </Link>
              <Link href="/admin/creators" className="lk-web-navlink">
                Applications
              </Link>
              <Link href="/admin/settlements" className="lk-web-navlink">
                Settlements
              </Link>
              <Link href="/admin/demo" className="lk-web-navlink">
                Demo
              </Link>
            </nav>
            <div className="lk-web-actions">
              <Link href="/" className="lk-web-signin">
                ← Lock In
              </Link>
            </div>
          </div>
        </header>
        <main className="lk-web-main">{children}</main>
      </div>
    );
  }

  return (
    <AppFrame
      username={profile.username}
      isKeyholder={profile.keyholder === true}
      isKeymaster={profile.keymaster === true}
      isAdmin={profile.isAdmin === true}
    >
      {children}
    </AppFrame>
  );
}
