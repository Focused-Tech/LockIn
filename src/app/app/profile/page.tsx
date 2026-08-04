import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchUserChatContext } from "@/server/data/userStats";
import { formatCents } from "@/lib/utils";
import { SignOutButton } from "../SignOutButton";
import "../lk-panels.css";

/**
 * PLAYER PROFILE — one page, two modes (the user's journey lane). ADVANCED is cash;
 * BEGINNER is coins, its own economy. THE TWO CURRENCIES NEVER APPEAR TOGETHER: cash
 * only in advanced, coins only in beginner. The wallet is its own panel with the
 * balance at 30px. The cross-slate entries link is removed. Normal scrolling page
 * (sticky header lives in the app chrome), so nothing below the fold is unreachable.
 */
export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const advanced = (profile.journeyLane ?? "advanced") !== "beginner";
  const stats = await fetchUserChatContext(adminDb(), profile.id, {
    includeCategoryStats: false,
  });

  const memberSince = profile.createdAt?.toMillis?.()
    ? new Date(profile.createdAt.toMillis()).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    : null;

  const initial = profile.username.charAt(0).toUpperCase();
  const coins = profile.coinBalance;
  const coinsWon = profile.practiceLifetimeCoins ?? 0;

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Identity */}
      <div className="blk">
        <div className="flex items-center gap-4">
          <span className={"av-ring " + (advanced ? "money" : "coin")}>{initial}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[20px] font-bold text-white">{profile.username}</h1>
              <span className={"modechip " + (advanced ? "cash" : "coins")}>
                {advanced ? "Cash" : "Coins"}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[#6E7787]">
              @{profile.username}
              {" · "}
              {profile.kycStatus === "verified" ? "Verified" : "Unverified"}
              {memberSince && ` · Member since ${memberSince}`}
            </p>
          </div>
        </div>
      </div>

      {/* Wallet — its OWN panel, balance at 30px. One currency, per mode. */}
      <Link href="/app/wallet" className={"blk block " + (advanced ? "money" : "coin")}>
        <div className="lb">
          {advanced ? "Cash balance" : "Coin balance"} <i></i>
        </div>
        <div className="hero">
          <div className="k">
            {advanced ? "Available to play or withdraw" : "Your score in beginner mode"}
          </div>
          {advanced ? (
            <div className="v cash">{formatCents(profile.cashBalanceCents)}</div>
          ) : (
            <div className="v coin">{coins.toLocaleString()}</div>
          )}
          <div className="sub">
            {advanced ? "Tap to deposit, withdraw or see activity" : "Coins are score — they buy nothing and never convert to cash"}
          </div>
        </div>
      </Link>

      {/* Lifetime stats — currency-neutral, plus one per-mode figure. */}
      <div className="blk">
        <div className="lb">Lifetime stats <i></i></div>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Contests played" value={String(stats.plays)} />
          <Stat label="Wins" value={String(stats.wins)} />
          <Stat label="Win rate" value={`${stats.winRatePct}%`} />
          {advanced ? (
            <Stat label="Total won" value={formatCents(stats.totalWonCents)} tone="cash" />
          ) : (
            <Stat label="Coins won" value={coinsWon.toLocaleString()} tone="coin" />
          )}
        </div>
      </div>

      {/* Creator CTA (advanced) / move-up CTA (beginner). */}
      {advanced ? (
        <Link
          href={profile.creatorVerified ? "/app/create" : "/app/apply"}
          className="blk act block"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-white">
                {profile.creatorVerified ? "Create a contest" : "Become a creator"}
              </b>
              <span className="mt-1 block text-[11.5px] text-[#6E7787]">
                {profile.creatorVerified
                  ? "Host a new prediction slate for your audience"
                  : "Host prediction contests for your audience and earn"}
              </span>
            </div>
            <span className="text-[19px] leading-none text-[#fc3e01]">›</span>
          </div>
        </Link>
      ) : (
        <Link href="/app/choose" className="blk act block">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-white">Move up to advanced</b>
              <span className="mt-1 block text-[11.5px] text-[#6E7787]">
                Play for real cash prizes instead of coins
              </span>
            </div>
            <span className="text-[19px] leading-none text-[#fc3e01]">›</span>
          </div>
        </Link>
      )}

      {/* Quick links — no cross-slate entries link. */}
      <div className="blk">
        <div className="lb">Account <i></i></div>
        <LinkRow href="/app/wallet" title="Wallet" hint={advanced ? "Balance, deposits & withdrawals" : "Coins, refills & activity"} />
        <LinkRow href="/app/leaderboard" title="Leaderboard" hint="Your standing on the board" />
        <LinkRow href="/app/refer" title="Refer" hint="Invite friends, earn rewards" />
        <LinkRow href="/app/responsible-play" title="Responsible play" hint={advanced ? "Deposit limits & self-exclusion" : "Reminders, breaks & support"} />
        <LinkRow href="/app/settings" title="Settings" hint="Sound, notifications, privacy & legal" />
        {advanced && (
          <LinkRow href="/app/creator" title="Creator" hint="Your hub, contests & earnings" />
        )}
      </div>

      {profile.isAdmin && (
        <Link href="/admin" className="blk block">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-white">Admin dashboard</b>
              <span className="mt-1 block text-[11.5px] text-[#6E7787]">
                Approve creators & review platform state
              </span>
            </div>
            <span className="text-[19px] leading-none text-[#6E7787]">›</span>
          </div>
        </Link>
      )}

      <div className="flex justify-center pt-1">
        <SignOutButton />
      </div>

      <p className="legal">
        Skill-based prediction contest platform. Not gambling. Not sports betting. 18+.
      </p>

      <SkillGameDisclaimer className="mt-2" />
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
  tone?: "cash" | "coin";
}) {
  const color = tone === "cash" ? "text-[#2fb98a]" : tone === "coin" ? "text-[#f0c463]" : "text-white";
  return (
    <div className="rounded-[12px] border border-[#232b37] bg-[linear-gradient(180deg,#12171F,#0E131A)] px-3 py-2.5">
      <p className="text-[11px] text-[#6E7787]">{label}</p>
      <p className={"mt-1 text-[19px] font-bold tabular-nums " + color}>{value}</p>
    </div>
  );
}

function LinkRow({ href, title, hint }: { href: string; title: string; hint: string }) {
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
