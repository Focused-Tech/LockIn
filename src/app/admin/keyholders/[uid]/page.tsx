import { notFound } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { isCurrentUserAdmin } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { fetchKeyholderPortal } from "@/server/data/keyholder";
import { KeyholderPortal } from "@/app/app/keyholder/KeyholderPortal";
import "../../../app/lk-panels.css";

/**
 * ADMIN — read-only PERFORMANCE view of any keyholder (Feature 2). Reuses fetchKeyholderPortal +
 * the KeyholderPortal component for the target uid, so an admin sees the same referred-creator /
 * player / projected-earnings picture the keyholder sees. Hard 404 for non-admins. No actions here.
 */
export default async function AdminKeyholderPerformance({ params }: { params: Promise<{ uid: string }> }) {
  if (!(await isCurrentUserAdmin())) notFound();
  const { uid } = await params;

  const [userSnap, data] = await Promise.all([
    adminDb().collection(COLLECTIONS.users).doc(uid).get(),
    fetchKeyholderPortal(adminDb(), uid),
  ]);
  if (!userSnap.exists) notFound();
  const user = userSnap.data() as UserDoc;

  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
      <div className="lk-acct px-4">
        <div className="phd" style={{ marginBottom: 4 }}>
          <div className="n">
            <b>Performance · @{user.username}</b>
            <span>
              Admin read-only view. <Link href="/admin/keyholders" style={{ color: "var(--brand-orange)" }}>← Roles</Link>
              {" · "}
              <Link href={`/admin/users/${uid}`} style={{ color: "var(--brand-orange)" }}>Profile ›</Link>
            </span>
          </div>
        </div>
      </div>
      <KeyholderPortal data={data} />
    </div>
  );
}
