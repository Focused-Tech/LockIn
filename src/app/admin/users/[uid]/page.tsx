import { notFound } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { isCurrentUserAdmin } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { formatCents } from "@/lib/utils";
import "../../../app/lk-panels.css";

/**
 * ADMIN — read-only user PROFILE (Feature 3). The arbitrary-user profile page that didn't exist
 * before: basic identity, roles, balances, and referral stats for any uid. Hard 404 for non-admins.
 * Read-only — no actions (role changes live on /admin/keyholders; no delete, no payout).
 */
export default async function AdminUserProfile({ params }: { params: Promise<{ uid: string }> }) {
  if (!(await isCurrentUserAdmin())) notFound();
  const { uid } = await params;

  const snap = await adminDb().collection(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) notFound();
  const u = snap.data() as UserDoc;

  const roles = [
    u.isAdmin && "Admin",
    u.keymaster && "Keymaster",
    u.keyholder && "Keyholder",
    u.creatorVerified && "Verified creator",
    u.isCreator && !u.creatorVerified && "Creator",
  ].filter(Boolean) as string[];

  const created = u.createdAt?.toMillis?.() ? new Date(u.createdAt.toMillis()).toLocaleDateString() : "—";

  const Row = ({ k, v, cash, coin }: { k: string; v: string; cash?: boolean; coin?: boolean }) => (
    <div className="row static">
      <span className="n"><b>{k}</b></span>
      <span className={"val" + (cash ? " cash" : coin ? " coin" : "")}>{v}</span>
    </div>
  );

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      <div className="phd">
        <div className="n">
          <b>@{u.username}</b>
          <span>
            Admin profile. <Link href="/admin/keyholders" style={{ color: "var(--brand-orange)" }}>← Roles</Link>
            {" · "}
            <Link href={`/admin/keyholders/${uid}`} style={{ color: "var(--brand-orange)" }}>Performance ›</Link>
          </span>
        </div>
      </div>

      <div className="blk">
        <div className="lb">Identity <i></i></div>
        <Row k="Username" v={`@${u.username}`} />
        <Row k="Email" v={u.email || "—"} />
        <Row k="Member since" v={created} />
        <Row k="Registered state" v={u.registeredState || "—"} />
        <Row k="KYC" v={u.kycStatus ?? "none"} />
      </div>

      <div className="blk">
        <div className="lb">Roles <i></i></div>
        {roles.length ? (
          <div className="badges" style={{ marginTop: 0 }}>
            {roles.map((r) => <span key={r} className="badge rank">{r}</span>)}
          </div>
        ) : (
          <p className="hint">No special roles.</p>
        )}
      </div>

      <div className="blk money">
        <div className="lb">Balances <i></i></div>
        <Row k="Cash" v={formatCents(u.cashBalanceCents ?? 0)} cash />
        <Row k="Coins" v={(u.coinBalance ?? 0).toLocaleString()} coin />
      </div>

      <div className="blk">
        <div className="lb">Referrals <i></i></div>
        <Row k="Referred users" v={String(u.referralCount ?? 0)} />
        <Row k="Referral earnings" v={formatCents(u.referralEarningsCents ?? 0)} cash />
        <Row k="Referred by (uid)" v={u.referredBy || "—"} />
      </div>
    </div>
  );
}
