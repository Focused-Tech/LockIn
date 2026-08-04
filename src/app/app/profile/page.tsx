import Link from "next/link";
import { redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchUserChatContext } from "@/server/data/userStats";
import { rankForCoins } from "@/lib/practice/tiers";
import { formatCents } from "@/lib/utils";
import { SignOutButton } from "../SignOutButton";
import "../lk-panels.css";

/**
 * PLAYER PROFILE — reconciled to public/design/Creator Builder/user_profile.html
 * (sha 4e8f97e3). One page, mode = journey lane. ADVANCED is cash; BEGINNER is coins,
 * its own economy — the two currencies never share the screen. Panel order mirrors the
 * spec order: identity · wallet (balance at 30px) · lifetime (6 stats) · Play · Account ·
 * sign out · legal. Normal scrolling page.
 */
export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";
  const stats = await fetchUserChatContext(adminDb(), profile.id, { includeCategoryStats: false });
  const rank = rankForCoins(profile.practiceLifetimeCoins ?? 0).tier.label;

  const memberSince = profile.createdAt?.toMillis?.()
    ? new Date(profile.createdAt.toMillis()).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const initial = profile.username.charAt(0).toUpperCase();
  const streak = profile.practiceStreak ?? 0;

  const sub = advanced
    ? `${profile.kycStatus === "verified" ? "Verified" : "Unverified"}${memberSince ? ` · Member since ${memberSince}` : ""}`
    : memberSince
      ? `Member since ${memberSince}`
      : "New player";

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Identity */}
      <div className="blk">
        <div className="phd">
          <div className="av">{initial}</div>
          <div className="n">
            <b>{profile.username}</b>
            <span>{sub}</span>
          </div>
        </div>
        <div className="badges">
          <span className="badge rank">{rank}</span>
          <span className={"badge mode" + (advanced ? "" : " b")}>{advanced ? "Cash" : "Coins"}</span>
        </div>
      </div>

      {/* Wallet — balance at 30px. One currency, per mode. */}
      <div className={"blk " + (advanced ? "money" : "coin")}>
        <div className="lb">Wallet <i></i></div>
        <div className="wal">
          <div className="l">
            <div className="k">{advanced ? "Cash balance" : "Coin balance"}</div>
            <div className={"v " + (advanced ? "cash" : "coin")}>
              {advanced ? formatCents(profile.cashBalanceCents) : profile.coinBalance.toLocaleString()}
            </div>
          </div>
          <Link className="go" href={advanced ? "/app/wallet" : "/app/beginner"}>
            {advanced ? "Deposit" : "Earn more"}
          </Link>
        </div>
        <div className="walsub">
          {advanced
            ? "Deposits, withdrawals and payout history. Your winnings land here."
            : "Coins are score. They buy nothing and never convert to cash."}
        </div>
      </div>

      {/* Lifetime — 6 stats. */}
      <div className={"blk " + (advanced ? "money" : "coin")}>
        <div className="lb">Lifetime <i></i></div>
        <div className="grid">
          <Stat k="Contests played" v={String(stats.plays)} />
          <Stat k="Wins" v={String(stats.wins)} />
          <Stat k="Win rate" v={`${stats.winRatePct}%`} />
          {advanced ? (
            <Stat k="Total won" v={formatCents(stats.totalWonCents)} tone="cash" />
          ) : (
            <Stat k="Coins won" v={(profile.practiceLifetimeCoins ?? 0).toLocaleString()} tone="coin" />
          )}
          <Stat k="Best finish" v="—" />
          <Stat k="Current streak" v={String(streak)} />
        </div>
      </div>

      {/* Play */}
      <div className="blk act">
        <div className="lb">Play <i></i></div>
        <PlayRow href={advanced ? "/app" : "/app/beginner"} title="Find a slate" hint={advanced ? "Live contests from creators" : "Coin contests — same game, no cash"} />
        <PlayRow href="/app/leaderboard" title="Ranks" hint="Your standing on the board" />
        {advanced ? (
          <PlayRow href={profile.creatorVerified ? "/app/creator" : "/app/apply"} title="Become a creator" hint="Host your own slate for your audience" />
        ) : (
          <PlayRow href="/app/choose" title="Move up to advanced" hint="Play the cash board when you are ready" />
        )}
      </div>

      {/* Account */}
      <div className="blk">
        <div className="lb">Account <i></i></div>
        <PlayRow href="/app/wallet" title="Wallet" hint={advanced ? "Balance, deposits & withdrawals" : "Your coin balance and daily refill"} />
        <PlayRow href="/app/refer" title="Refer" hint="Invite friends, earn rewards" />
        <PlayRow href="/app/responsible-play" title="Responsible play" hint={advanced ? "Deposit limits & self-exclusion" : "Limits & self-exclusion"} />
        <PlayRow href="/app/settings" title="Settings" hint="Notifications, sound & privacy" />
      </div>

      <SignOutButton />

      <p className="legal">
        Skill-based prediction contest platform. Not gambling. Not sports betting. 18+.
      </p>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "cash" | "coin" }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={"v" + (tone ? " " + tone : "")}>{v}</div>
    </div>
  );
}

function PlayRow({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link href={href} className="row">
      <span className="n">
        <b>{title}</b>
        <span>{hint}</span>
      </span>
      <span className="cv">›</span>
    </Link>
  );
}
