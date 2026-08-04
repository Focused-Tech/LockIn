import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { SettingsView } from "./SettingsView";
import "../lk-panels.css";

/**
 * SETTINGS — sound, notifications, account, privacy, legal, danger zone. Real fields
 * (email, verification, location) come from the user doc; the audio toggles share the
 * practice keys so this is their permanent home without forking the state.
 */
export default async function SettingsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsView
      email={profile.email}
      location={profile.registeredState}
      verified={profile.kycStatus === "verified"}
    />
  );
}
