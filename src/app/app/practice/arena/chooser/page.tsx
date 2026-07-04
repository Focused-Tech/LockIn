import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { ArenaChooser } from "./ArenaChooser";

/**
 * CHOOSE YOUR ARENA — mode-selection carousel. Thin auth gate; the carousel
 * fills the frame, so this page skips the usual p-6 content padding.
 */
export default async function ArenaChooserPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="page-enter h-full">
      <ArenaChooser />
    </div>
  );
}
