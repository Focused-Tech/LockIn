import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import {
  fetchLeaderboard,
  type LeaderRow,
  type LeaderboardWindow,
} from "@/server/data/leaderboard";
import "../lk-panels.css";

const TABS: { key: LeaderboardWindow; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "all", label: "All time" },
];

/**
 * LEADERBOARD — RANK IS SCORE, NEVER MONEY (§3). The board is re-ranked by wins
 * (then win rate, then plays) for display and shows no cash figure. Movement deltas
 * have no prior-position source yet, so they render as "—" (honest empty). Your own
 * row is highlighted; your standing shows position, percentile, and the gap to the
 * player above you.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const window: LeaderboardWindow =
    sp.window === "today" || sp.window === "week" ? sp.window : "all";

  const data = await fetchLeaderboard(adminDb(), window, profile.id);

  // §3 — re-rank by SCORE (wins → win rate → plays), renumber, no money.
  const pool = [...data.rows];
  if (data.currentUserRow && !pool.some((r) => r.userId === data.currentUserRow!.userId)) {
    pool.push(data.currentUserRow);
  }
  const ranked = pool
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.plays - a.plays)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const field = ranked.length;
  const meIdx = ranked.findIndex((r) => r.isCurrentUser);
  const me = meIdx >= 0 ? ranked[meIdx]! : null;
  const above = meIdx > 0 ? ranked[meIdx - 1]! : null;
  const percentile = me && field > 0 ? Math.max(1, Math.round((me.rank / field) * 100)) : null;
  const gapToNext = me && above ? above.wins - me.wins : 0;

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Your standing */}
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
              <b>{me.wins.toLocaleString()}</b>
              <span>wins</span>
            </div>
          </div>
          <p className="hint mt-3">
            {above
              ? `${gapToNext <= 0 ? "Tied for" : `${gapToNext} win${gapToNext === 1 ? "" : "s"} to`} #${above.rank}. Placing top 3 in any contest moves you fastest.`
              : "Top of the board. Placing top 3 in any contest keeps you there."}
          </p>
        </div>
      ) : (
        <div className="blk act">
          <div className="lb">Your standing <i></i></div>
          <p className="hint">Play a contest to land on the board — rank is your win count, not money.</p>
        </div>
      )}

      {/* The board */}
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
          ranked.slice(0, 50).map((r) => <BoardRow key={r.userId} row={r} />)
        )}
      </div>

      <p className="hint">Rank is score, not money. Every contest you finish counts toward it.</p>

      <SkillGameDisclaimer className="mt-2" />
    </div>
  );
}

function BoardRow({ row }: { row: LeaderRow }) {
  const you = row.isCurrentUser;
  return (
    <div className={"lrow" + (you ? " you" : "")}>
      <div className={"p" + (row.rank <= 3 ? " top" : "")}>{row.rank}</div>
      <div className="av">{(row.username || "?").charAt(0).toUpperCase()}</div>
      <div className="h">{you ? "You" : `@${row.username}`}</div>
      <div className="s">{row.wins.toLocaleString()}</div>
      {/* Movement deltas have no prior-position source yet — honest empty. */}
      <div className="d eq">—</div>
    </div>
  );
}
