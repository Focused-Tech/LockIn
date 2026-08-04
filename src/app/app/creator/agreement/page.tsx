import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchSignedSections, isCreatorOnboarded } from "@/server/data/creatorAgreement";
import { AgreementFlow } from "./AgreementFlow";
import "../../lk-panels.css";
import "./agreement.css";

/**
 * CREATOR AGREEMENT route. The gate lands here (from /app/create) when a verified creator
 * has not fully signed the current agreement version. An already-onboarded creator is sent
 * straight back to the hub — they never see this again unless the version bumps. Resumes at
 * the first unsigned section for an abandoned flow.
 */
export default async function CreatorAgreementPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");
  if (isCreatorOnboarded(profile)) redirect("/app/creator");

  const signed = await fetchSignedSections(adminDb(), profile.id);

  return <AgreementFlow initialSigned={signed} />;
}
