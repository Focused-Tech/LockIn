import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { CreatorBuilder } from "../CreatorBuilder";

/**
 * CASH creator mode — the hub + 4-step builder, built to
 * public/design/Creator Builder/creator_builder.html (the spec file is canon). The hub is the entry;
 * "Build a slate" drops into the four steps. CreatorMode.tsx (the live-data builder) is FROZEN this
 * pass — untouched, just no longer this route's render. Auth guards only; the surface is self-contained.
 */
export default async function CreatorModePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");

  return <CreatorBuilder />;
}
