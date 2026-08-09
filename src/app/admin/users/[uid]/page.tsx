import { notFound } from "next/navigation";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import { isCurrentUserAdmin } from "@/lib/firebase/session";
import { COLLECTIONS, type UserDoc } from "@/lib/firebase/types";
import { formatCents } from "@/lib/utils";
import "../../../app/lk-panels.css";

/** Distinct colour per role so the badges aren't four identical purple pills (ruling E). */
function roleBadgeStyle(role: string): { bg: string; border: string; color: string } {
  switch (role) {
    case "Admin":
      return { bg: "rgba(224,67,44,.18)", border: "rgba(224,67,44,.55)", color: "#f3a99b" };
    case "Keymaster":
      return { bg: "rgba(240,196,99,.16)", border: "rgba(240,196,99,.55)", color: "#f5d89a" };
    case "Keyholder":
      return { bg: "rgba(124,92,245,.2)", border: "rgba(124,92,245,.6)", color: "#c9bcff" };
    default: // Verified creator / Creator
      return { bg: "rgba(47,185,138,.18)", border: "rgba(47,185,138,.55)", color: "#7fe3c0" };
  }
}

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
          <b>Profile</b>
          <span>
            @{u.username} — identity, roles &amp; balances.{" "}
            <Link href={`/admin/keyholders/${uid}`} style={{ color: "var(--brand-orange)" }}>Performance ›</Link>
            {" · "}
            <Link href="/admin/keyholders" style={{ color: "var(--brand-orange)" }}>Roles</Link>
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
            {roles.map((r) => {
              const s = roleBadgeStyle(r);
              return (
                <span key={r} className="badge" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                  {r}
                </span>
              );
            })}
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
