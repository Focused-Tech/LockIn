import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type CreatorApplicationDoc,
} from "@/lib/firebase/types";
import { AdminReviewList, type ReviewRow } from "./AdminReviewList";

export const runtime = "nodejs";

export default async function AdminCreatorsPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");
  if (!isAdminUid(uid)) notFound(); // hide the route from non-admins

  const snap = await adminDb()
    .collection(COLLECTIONS.creatorApplications)
    .where("status", "==", "pending")
    .get();

  const rows: ReviewRow[] = snap.docs
    .map((d) => {
      const a = d.data() as CreatorApplicationDoc;
      return {
        userId: a.userId,
        username: a.username,
        audienceUrl: a.audienceUrl,
        audienceSize: a.audienceSize ?? 0,
        categories: a.categories ?? [],
        pitch: a.pitch,
        createdAtMs: a.createdAt?.toMillis?.() ?? 0,
      };
    })
    .sort((x, y) => x.createdAtMs - y.createdAtMs); // oldest first

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Link
          href="/admin/settlements"
          className="text-sm text-muted hover:text-foreground"
        >
          Settlement review →
        </Link>
      </header>

      <div>
        <h1 className="text-xl font-semibold">Creator applications</h1>
        <p className="text-sm text-muted">
          {rows.length} pending review.
        </p>
      </div>

      <AdminReviewList rows={rows} />
    </main>
  );
}
