import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchKeyholderPortal } from "@/server/data/keyholder";
import { KeyholderPortal } from "./KeyholderPortal";
import "../lk-panels.css";

/**
 * KEYHOLDER PORTAL — role-gated. A non-keyholder gets a hard 404 (notFound), NOT a locked page:
 * the route does not exist for them. Server-rendered; the portal reads only the keyholder's own
 * referrals + projected earnings (no house margins — see fetchKeyholderPortal).
 */
export default async function KeyholderPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.keyholder) notFound();

  const data = await fetchKeyholderPortal(adminDb(), profile.id);
  return <KeyholderPortal data={data} />;
}
