import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { JourneyPicker } from "./JourneyPicker";

/** Choose-your-journey screen — the canonical lane picker (Beginner/Advanced). */
export default async function ChooseJourneyPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  return <JourneyPicker />;
}
