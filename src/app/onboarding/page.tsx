import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/firebase/session";
import { CATEGORIES } from "@/lib/categories";
import { OnboardingFlow } from "./OnboardingFlow";

export default async function OnboardingPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  return <OnboardingFlow categories={[...CATEGORIES]} />;
}
