import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  fetchLeaderboard,
  type LeaderRow,
  type LeaderboardWindow,
} from "@/server/data/leaderboard";
import { PAID_LINE } from "@/lib/beginner/payoutModel";
import { formatCents } from "@/lib/utils";
import Link from "next/link";
import "../lk-panels.css";

const TABS: { key: LeaderboardWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

/**
 * LEADERBOARD (panel language). ADVANCED ranks by CASH WON (fetchLeaderboard's native
 * order) and shows the cash paid-line — restored to the shipped, pre-build behaviour;
 * ranking by score was an unauthorized change and is reverted here. BEGINNER has no cash
 * to rank by, so it ranks by SCORE (wins, then win rate, then plays) and shows no dollar figure.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");
  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";

  const sp = await searchParams;
  const window: LeaderboardWindow =
    sp.window === "today" || sp.window === "week" ? sp.window : "all";

  const data = await fetchLeaderboard(adminDb(), window, profile.id);

  // ADVANCED: cash-won order straight from fetchLeaderboard (ranked by totalWonCents).
  // BEGINNER: re-rank by score (wins), renumber, and never show cash.
  const base = [...data.rows];
  if (data.currentUserRow && !base.some((r) => r.userId === data.currentUserRow!.userId)) {
    base.push(data.currentUserRow);
  }
  const ranked = advanced
    ? base.map((r, i) => ({ ...r, rank: i + 1 }))
    : base
        .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.plays - a.plays)
        .map((r, i) => ({ ...r, rank: i + 1 }));

  const field = ranked.length;
  const meIdx = ranked.findIndex((r) => r.isCurrentUser);
  const me = meIdx >= 0 ? ranked[meIdx]! : null;
  const above = meIdx > 0 ? ranked[meIdx - 1]! : null;
  const percentile = me && field > 0 ? Math.max(1, Math.round((me.rank / field) * 100)) : null;
  // ADVANCED paid-line: the top PAID_LINE% cash in a contest.
  const paidLineRank = advanced && field > 0 ? Math.max(1, Math.round((field * PAID_LINE) / 100)) : 0;

  const meValue = me ? (advanced ? formatCents(me.totalWonCents) : me.wins.toLocaleString()) : "";
  const gap =
    me && above
      ? advanced
        ? `${formatCents(Math.max(0, above.totalWonCents - me.totalWonCents))} to #${above.rank}`
        : `${Math.max(0, above.wins - me.wins)} win${above.wins - me.wins === 1 ? "" : "s"} to #${above.rank}`
      : null;

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {me ? (
        <div className="blk act">
          <div className="lb">Your standing <i></i></div>
          <div className="me">
            <div className="pos">#{me.rank}</div>
            <div className="n">
              <b>{me.username || "You"}</b>
              <span>{percentile != null ? `Top ${percentile}% this ${window === "all" ? "season" : window}` : "Unranked"}</span>
            </div>
            <div className="sc">
              <b>{meValue}</b>
              <span>{advanced ? "won" : "wins"}</span>
            </div>
          </div>
          <p className="hint mt-3">
            {gap ? `${gap}. Placing top 3 in any contest moves you fastest.` : "Top of the board. Placing top 3 keeps you there."}
          </p>
        </div>
      ) : (
        <div className="blk act">
          <div className="lb">Your standing <i></i></div>
          <p className="hint">
            {advanced ? "Play a paid contest to land on the board." : "Play a contest to land on the board — beginner rank is your win count."}
          </p>
        </div>
      )}

      <div className="blk">
        <div className="lb">The board <i></i></div>
        <div className="tabs">
          {TABS.map((t) => (
            <Link key={t.key} href={`/app/leaderboard?window=${t.key}`} className={"tab" + (t.key === window ? " on" : "")}>
              {t.label}
            </Link>
          ))}
        </div>
        {ranked.length === 0 ? (
          <p className="hint">No settled contests in this window yet.</p>
        ) : (
          ranked.slice(0, 50).map((r, i) => (
            <div key={r.userId}>
              {advanced && i === paidLineRank && (
                <div className="flex items-center gap-2 py-1.5 text-[11px] font-bold" style={{ color: "#2fb98a" }}>
                  <span className="h-px flex-1" style={{ background: "rgba(47,185,138,.4)" }} />
                  Paid line · top {PAID_LINE}%
                  <span className="h-px flex-1" style={{ background: "rgba(47,185,138,.4)" }} />
                </div>
              )}
              <BoardRow row={r} advanced={advanced} />
            </div>
          ))
        )}
      </div>

      <p className="hint">
        {advanced
          ? `The top ${PAID_LINE}% finish in the money in a contest. Every paid contest you settle counts.`
          : "Rank is score, not money. Every contest you finish counts toward it."}
      </p>

      <SkillGameDisclaimer className="mt-2" />
    </div>
  );
}

function BoardRow({ row, advanced }: { row: LeaderRow; advanced: boolean }) {
  const you = row.isCurrentUser;
  return (
    <div className={"lrow" + (you ? " you" : "")}>
      <div className={"p" + (row.rank <= 3 ? " top" : "")}>{row.rank}</div>
      <div className="av">{(row.username || "?").charAt(0).toUpperCase()}</div>
      <div className="h">{you ? "You" : `@${row.username}`}</div>
      <div className="s">{advanced ? formatCents(row.totalWonCents) : row.wins.toLocaleString()}</div>
    </div>
  );
}
