import Link from "next/link";
import { redirect } from "next/navigation";
import { ProBadge } from "@/components/ProBadge";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import {
  fetchLeaderboard,
  type LeaderRow,
  type LeaderboardWindow,
} from "@/server/data/leaderboard";
import { formatCents } from "@/lib/utils";

const TABS: { key: LeaderboardWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "all", label: "All Time" },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const sp = await searchParams;
  const window: LeaderboardWindow =
    sp.window === "today" || sp.window === "week" ? sp.window : "all";

  const data = await fetchLeaderboard(adminDb(), window, uid);
  const podium = data.rows.slice(0, 3);
  const rest = data.rows.slice(3);

  return (
    <div className="flex flex-col gap-5 p-6">
      <h1 className="text-xl font-semibold">Leaderboard</h1>

      {/* Window tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => {
          const active = t.key === window;
          return (
            <Link
              key={t.key}
              href={`/app/leaderboard?window=${t.key}`}
              className={
                "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                (active
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border text-muted hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {data.rows.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted">
          No settled contests in this window yet.
        </Card>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 gap-2">
            {podium.map((r) => (
              <PodiumCard key={r.userId} row={r} />
            ))}
          </div>

          {/* The rest */}
          {rest.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded border border-border">
              {rest.map((r) => (
                <RankRow key={r.userId} row={r} />
              ))}
            </ul>
          )}

          {/* Pinned current user when outside the top list */}
          {data.currentUserRow && (
            <div>
              <p className="mb-1 text-xs text-muted">Your rank</p>
              <ul className="overflow-hidden rounded border border-accent-border">
                <RankRow row={data.currentUserRow} />
              </ul>
            </div>
          )}
        </>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}

function PodiumCard({ row }: { row: LeaderRow }) {
  const first = row.rank === 1;
  return (
    <Card
      className={
        "flex flex-col items-center gap-1 text-center " +
        (first ? "border-accent-border bg-accent-soft" : "")
      }
    >
      <span
        className={
          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold " +
          (first ? "bg-accent text-background" : "bg-surface text-foreground")
        }
      >
        {row.rank}
      </span>
      <span className="mt-1 flex max-w-full items-center gap-1 text-sm font-medium">
        <span className="truncate">{row.username}</span>
        {row.isPro && <ProBadge />}
      </span>
      <span className="text-sm font-semibold text-win">
        {formatCents(row.totalWonCents)}
      </span>
      <span className="text-xs text-muted">{row.winRate}% win</span>
    </Card>
  );
}

function RankRow({ row }: { row: LeaderRow }) {
  return (
    <li
      className={
        "flex items-center justify-between px-4 py-3 " +
        (row.isCurrentUser ? "bg-accent-soft" : "bg-surface-card")
      }
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-sm text-muted">{row.rank}</span>
        <div>
          <p className="flex items-center gap-1 text-sm font-medium text-foreground">
            {row.username}
            {row.isPro && <ProBadge />}
            {row.isCurrentUser && (
              <span className="text-xs text-accent">you</span>
            )}
          </p>
          <p className="text-xs text-muted">
            {row.wins}W · {row.winRate}% · {row.plays} played
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {row.streak > 0 && <Pill tone="live">{row.streak}🔥</Pill>}
        <span className="text-sm font-semibold text-win">
          {formatCents(row.totalWonCents)}
        </span>
      </div>
    </li>
  );
}
