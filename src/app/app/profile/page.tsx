import Link from "next/link";
import { redirect } from "next/navigation";
import { ProBadge } from "@/components/ProBadge";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchUserChatContext } from "@/server/data/userStats";
import { formatCents } from "@/lib/utils";
import { CategoryPerformance } from "../pro/CategoryPerformance";
import { SignOutButton } from "../SignOutButton";

const QUICK_LINKS = [
  { href: "/app/wallet", label: "Wallet", hint: "Balance, deposits & withdrawals" },
  { href: "/app/leaderboard", label: "Ranks", hint: "Your standing on the board" },
  { href: "/app/parlays", label: "Parlays", hint: "Your cross-slate entries" },
  { href: "/app/refer", label: "Refer", hint: "Invite friends, earn rewards" },
  { href: "/app/creator", label: "Creator dashboard", hint: "Your contests & earnings" },
  {
    href: "/app/responsible-play",
    label: "Responsible play",
    hint: "Deposit limits & self-exclusion",
  },
];

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const stats = await fetchUserChatContext(adminDb(), profile.id, {
    includeCategoryStats: profile.proSubscriber,
  });

  const memberSince = profile.createdAt?.toMillis?.()
    ? new Date(profile.createdAt.toMillis()).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;
  const proExpiresMs = profile.proExpiresAt?.toMillis?.() ?? 0;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Identity */}
      <Card className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface text-xl font-semibold text-foreground">
          {profile.username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{profile.username}</h1>
            {profile.proSubscriber && <ProBadge />}
          </div>
          <p className="text-sm text-muted">
            {profile.kycStatus === "verified" ? "Verified" : "Unverified"}
            {memberSince && ` · Member since ${memberSince}`}
          </p>
        </div>
      </Card>

      {/* Pro status */}
      {profile.proSubscriber ? (
        <Link
          href="/app/pro"
          className="flex items-center justify-between rounded border border-ai/30 bg-[rgba(59,139,255,0.06)] px-4 py-3"
        >
          <span className="text-sm">
            <span className="font-semibold text-ai">LockIn Pro is active.</span>{" "}
            {proExpiresMs > 0 && (
              <span className="text-muted">
                Renews {new Date(proExpiresMs).toLocaleDateString()}.
              </span>
            )}
          </span>
          <span className="text-sm text-ai">Manage →</span>
        </Link>
      ) : (
        <Link
          href="/app/pro"
          className="flex items-center justify-between rounded border border-ai/30 bg-[rgba(59,139,255,0.06)] px-4 py-3"
        >
          <span className="text-sm text-muted">
            Go Pro for the AI Strategy Advisor and your category performance.
          </span>
          <span className="text-sm font-medium text-ai">Go Pro →</span>
        </Link>
      )}

      {/* Lifetime stats */}
      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Lifetime stats</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Contests played" value={String(stats.plays)} />
          <Stat label="Wins" value={String(stats.wins)} />
          <Stat label="Win rate" value={`${stats.winRatePct}%`} />
          <Stat
            label="Total won"
            value={formatCents(stats.totalWonCents)}
            tone="win"
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Pill tone="win">{profile.coinBalance} coins</Pill>
          <Pill tone="accent">{formatCents(profile.cashBalanceCents)}</Pill>
        </div>
      </Card>

      {/* Category performance — Pro only */}
      {profile.proSubscriber && (
        <CategoryPerformance stats={stats.categoryStats ?? []} />
      )}

      {/* Creator entry point — state-aware so the journey is always one tap away */}
      <Link
        href={profile.creatorVerified ? "/app/create" : "/app/apply"}
        className="flex items-center justify-between rounded border border-accent-border bg-accent-soft px-4 py-3"
      >
        <span className="text-sm">
          <span className="block font-semibold text-accent">
            {profile.creatorVerified ? "Create a contest" : "Become a creator"}
          </span>
          <span className="block text-xs text-muted">
            {profile.creatorVerified
              ? "Host a new prediction slate for your audience"
              : "Apply to host prediction contests and earn"}
          </span>
        </span>
        <span className="text-sm font-medium text-accent">→</span>
      </Link>

      {/* Admin-only: front door to the owner dashboard (web) */}
      {profile.isAdmin && (
        <Link
          href="/admin"
          className="flex items-center justify-between rounded border border-border bg-surface-card px-4 py-3"
        >
          <span className="text-sm">
            <span className="block font-semibold text-foreground">
              Admin dashboard
            </span>
            <span className="block text-xs text-muted">
              Approve creators & review platform state
            </span>
          </span>
          <span className="text-muted">→</span>
        </Link>
      )}

      {/* Quick links */}
      <ul className="flex flex-col overflow-hidden rounded border border-border">
        {QUICK_LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex items-center justify-between bg-surface-card px-4 py-3 hover:bg-surface"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {l.label}
                </span>
                <span className="block text-xs text-muted">{l.hint}</span>
              </span>
              <span className="text-muted">→</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <SignOutButton />
      </div>

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win";
}) {
  return (
    <div className="rounded border border-border bg-surface-card px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={
          "text-lg font-semibold " + (tone === "win" ? "text-win" : "text-foreground")
        }
      >
        {value}
      </p>
    </div>
  );
}
