import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchReferralDashboard } from "@/server/data/referrals";
import { ReferralView } from "./ReferralView";
import "../lk-panels.css";

export default async function ReferPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";
  const data = await fetchReferralDashboard(adminDb(), profile.id);

  return <ReferralView data={data} advanced={advanced} />;
}
