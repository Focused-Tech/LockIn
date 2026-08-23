import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app/AppFrame";
import { BackToStart } from "@/components/web/BackToStart";
import { getCurrentUserProfile } from "@/lib/firebase/session";

/**
 * ADMIN SHELL — every /admin route renders inside the same {@link AppFrame} as the app (header +
 * avatar drawer with Sign out + bottom nav + safe-area insets). This ends the "trap" where an admin
 * route had no chrome and no way out. Per-page `notFound()` still gates non-admins; auth is checked
 * here so an unauthenticated hit bounces to /login instead of rendering an empty frame.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <AppFrame
      username={profile.username}
      isKeyholder={profile.keyholder === true}
      isKeymaster={profile.keymaster === true}
      isAdmin={profile.isAdmin === true}
    >
      <BackToStart />
      {children}
    </AppFrame>
  );
}
