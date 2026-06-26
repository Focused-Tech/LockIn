import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import { fetchPendingReviewSlates } from "@/server/data/review";
import { ReviewSettleList } from "./ReviewSettleList";

export const runtime = "nodejs";

export default async function AdminSettlementsPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");
  if (!isAdminUid(uid)) notFound();

  const slates = await fetchPendingReviewSlates(adminDb());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-5 p-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Link
          href="/admin/creators"
          className="text-sm text-muted hover:text-foreground"
        >
          Applications →
        </Link>
      </header>

      <div>
        <h1 className="text-xl font-semibold">Settlement review</h1>
        <p className="text-sm text-muted">
          {slates.length} contest(s) need a manual outcome before payout.
        </p>
      </div>

      <ReviewSettleList slates={slates} />
    </main>
  );
}
