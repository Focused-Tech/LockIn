import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { isWeb } from "@/lib/surface";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId, isAdminUid } from "@/lib/firebase/session";
import {
  COLLECTIONS,
  type CreatorApplicationDoc,
  type SlateDoc,
  type UserDoc,
} from "@/lib/firebase/types";
import {
  AdminDashboard,
  type AdminSlateRow,
  type AdminUserRow,
  type PendingRow,
} from "./AdminDashboard";

export const runtime = "nodejs";

function mapUser(id: string, u: UserDoc): AdminUserRow {
  return {
    id,
    username: u.username,
    email: u.email,
    isAdmin: u.isAdmin === true,
    isCreator: u.isCreator === true,
    creatorVerified: u.creatorVerified === true,
    kycStatus: u.kycStatus,
    coinBalance: u.coinBalance ?? 0,
    cashBalanceCents: u.cashBalanceCents ?? 0,
  };
}

export default async function AdminHome() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");
  if (!(await isAdminUid(uid))) notFound(); // 404 for non-admins — no leak

  const db = adminDb();
  const ownSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const own = ownSnap.data() as UserDoc | undefined;

  const [pendingSnap, creatorsSnap, slatesSnap, usersSnap, userCountSnap, slateCountSnap] =
    await Promise.all([
      db
        .collection(COLLECTIONS.creatorApplications)
        .where("status", "==", "pending")
        .get(),
      db.collection(COLLECTIONS.users).where("creatorVerified", "==", true).get(),
      db.collection(COLLECTIONS.slates).orderBy("createdAt", "desc").limit(50).get(),
      db.collection(COLLECTIONS.users).orderBy("createdAt", "desc").limit(50).get(),
      db.collection(COLLECTIONS.users).count().get(),
      db.collection(COLLECTIONS.slates).count().get(),
    ]);

  const pending: PendingRow[] = pendingSnap.docs
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
    .sort((x, y) => x.createdAtMs - y.createdAtMs);

  const creators: AdminUserRow[] = creatorsSnap.docs
    .map((d) => mapUser(d.id, d.data() as UserDoc))
    .sort((a, b) => a.username.localeCompare(b.username));

  const slates: AdminSlateRow[] = slatesSnap.docs.map((d) => {
    const s = d.data() as SlateDoc;
    return {
      id: d.id,
      title: s.title,
      category: s.category,
      status: s.status,
      creatorId: s.creatorId,
      entryCount: s.entryCount ?? 0,
    };
  });

  const users: AdminUserRow[] = usersSnap.docs.map((d) =>
    mapUser(d.id, d.data() as UserDoc),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      {/* On WEB the admin layout supplies the site header. Rendering this one as well is what put
          the wordmark and "Admin" on top of "Applications" at desktop width. Mobile still needs it,
          because the phone shell's TopNav carries no admin navigation. */}
      {!isWeb() && (
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm font-semibold text-muted">Admin</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/creators" className="text-muted hover:text-foreground">
            Applications
          </Link>
          <Link
            href="/admin/settlements"
            className="text-muted hover:text-foreground"
          >
            Settlements
          </Link>
          {/* Presentation demo — owner-only. The route 404s for non-admins regardless of this
              link, so the link is a convenience, never the gate. */}
          <Link href="/admin/demo" className="text-muted hover:text-foreground">
            Demo
          </Link>
          <Link href="/app" className="text-muted hover:text-foreground">
            ← App
          </Link>
        </nav>
      </header>
      )}

      <div>
        <h1 className="text-xl font-semibold">Owner dashboard</h1>
        <p className="text-sm text-muted">
          Approve creators and review platform state.
        </p>
      </div>

      <AdminDashboard
        ownUid={uid}
        ownUsername={own?.username ?? "you"}
        ownIsCreatorVerified={own?.creatorVerified === true}
        pending={pending}
        creators={creators}
        slates={slates}
        users={users}
        userCount={userCountSnap.data().count}
        slateCount={slateCountSnap.data().count}
      />
    </main>
  );
}
