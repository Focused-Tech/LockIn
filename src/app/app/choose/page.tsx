import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { JourneyPicker } from "./JourneyPicker";

/** Journey hub — the app's front door: continue to your saved lane, or switch. */
export default async function ChooseJourneyPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return (
    <JourneyPicker
      currentLane={profile.journeyLane ?? null}
      creatorVerified={profile.creatorVerified === true}
    />
  );
}
