import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchCreatorDashboard } from "@/server/data/creator";
import { formatCents } from "@/lib/utils";
import { ConnectPayoutCard } from "./ConnectPayoutCard";

const EARNING_LABELS: Record<string, string> = {
  hosting: "Hosting fees",
  package: "Pick packages",
  referral: "Referrals",
  pro_commission: "Pro commission",
};

function statusTone(status: string) {
  if (status === "live") return "live" as const;
  if (status === "settled") return "win" as const;
  if (status === "cancelled") return "loss" as const;
  return "neutral" as const;
}

export default async function CreatorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  if (!profile.creatorVerified) redirect("/app/apply");

  const { connect } = await searchParams;
  const data = await fetchCreatorDashboard(adminDb(), profile.id);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Creator</h1>
          <p className="text-sm text-muted">Your contests and earnings.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/app/refer"
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
          >
            Invite
          </Link>
          <Link
            href="/app/create"
            className="rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
          >
            + New contest
          </Link>
        </div>
      </div>

      <ConnectPayoutCard
        connected={profile.creatorStripeConnectId !== null}
        payoutsEnabled={profile.creatorPayoutsEnabled}
        justReturned={connect === "return"}
      />

      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-muted">Earnings</p>
          <p className="mt-1 text-lg font-semibold text-win">
            {formatCents(data.totalNetCents)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Contests</p>
          <p className="mt-1 text-lg font-semibold">{data.slateCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Entries</p>
          <p className="mt-1 text-lg font-semibold">{data.totalEntries}</p>
        </Card>
      </div>

      {data.slateCount === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted">
            You haven&apos;t hosted a contest yet.
          </p>
          <Link
            href="/app/create"
            className="rounded border border-accent-border bg-accent-soft px-4 py-2 text-sm font-medium text-accent"
          >
            Host your first contest
          </Link>
        </Card>
      ) : (
        <>
          {/* Earnings breakdown */}
          {data.totalNetCents > 0 && (
            <Card className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Earnings breakdown</h2>
              {Object.entries(data.byType)
                .filter(([, cents]) => cents > 0)
                .map(([type, cents]) => (
                  <div
                    key={type}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted">
                      {EARNING_LABELS[type] ?? type}
                    </span>
                    <span className="font-medium">{formatCents(cents)}</span>
                  </div>
                ))}
              <p className="mt-1 text-xs text-muted">
                You keep 40% of hosting fees. Earnings land in your cash balance —
                withdraw from the wallet.
              </p>
            </Card>
          )}

          {/* Slate list */}
          <div>
            <h2 className="mb-2 text-sm font-semibold">Your contests</h2>
            <ul className="flex flex-col gap-2">
              {data.slates.map((s) => (
                <li key={s.id}>
                  <Link href={`/app/slate/${s.id}`}>
                    <Card className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {s.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Pill tone="accent">{s.category}</Pill>
                          <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                          <span className="text-xs text-muted">
                            {s.entryCount} entries
                          </span>
                        </div>
                      </div>
                      {s.netCents > 0 && (
                        <span className="shrink-0 text-sm font-semibold text-win">
                          {formatCents(s.netCents)}
                        </span>
                      )}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
