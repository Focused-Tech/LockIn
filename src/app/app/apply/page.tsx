import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type CreatorApplicationDoc,
} from "@/lib/firebase/types";
import { ApplyForm } from "./ApplyForm";

export default async function ApplyPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  // Already approved → no need to apply.
  if (profile.creatorVerified) redirect("/app/creator");

  const appSnap = await adminDb()
    .collection(COLLECTIONS.creatorApplications)
    .doc(profile.id)
    .get();
  const application = appSnap.exists
    ? (appSnap.data() as CreatorApplicationDoc)
    : null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Become a creator</h1>
        <p className="text-sm text-muted">
          Host prediction contests for your audience and earn 40% of hosting
          fees and pick-package sales.
        </p>
      </div>

      {application?.status === "pending" ? (
        <Card className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-accent">
            Application under review
          </p>
          <p className="text-sm text-muted">
            Thanks for applying — our team is reviewing your application. We&apos;ll
            email you once it&apos;s approved, and you&apos;ll be able to host
            contests and set up payouts.
          </p>
        </Card>
      ) : (
        <ApplyForm
          rejectedNote={
            application?.status === "rejected" ? application.reviewNote : null
          }
        />
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
