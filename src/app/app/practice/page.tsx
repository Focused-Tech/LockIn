import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Pill } from "@/components/ui";
import { RankBadge } from "@/components/practice/RankBadge";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchPracticeHome } from "@/server/data/practice";
import { isBusted } from "@/lib/practice/scoring";
import { PRACTICE_CONFIG, type PracticeTierKey } from "@/lib/practice/config";
import { PracticeHomeClient } from "./PracticeHomeClient";
import { AiCreatorsSection } from "./AiCreatorsSection";
import { AudioSettings } from "@/components/practice/AudioSettings";
import { PracticeMusic } from "@/components/practice/PracticeMusic";

const SHARP_PCT = PRACTICE_CONFIG.sharpPercentile;

export default async function PracticeHomePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const home = await fetchPracticeHome(profile.id, profile);
  const tierKey = home.rank.tier.key as PracticeTierKey;
  const busted = isBusted(home.practiceCoins);

  return (
    <div className="page-enter flex flex-col gap-4 p-6">
      <PracticeMusic track="solo" />
      <div>
        <h1 className="text-xl font-semibold">Practice arena</h1>
        <p className="text-sm text-muted">
          Compete with friends for coins, rank, and bragging rights.{" "}
          <span className="text-foreground">Play-money only</span> — coins are
          score; they buy nothing and never convert to cash.
        </p>
      </div>

      {/* Rank + coins */}
      <div className="arena-panel flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RankBadge tier={tierKey} label={home.rank.tier.label} />
            <span className="text-xs text-muted">{home.rank.tier.blurb}</span>
          </div>
          <Pill tone="win">🪙 {home.practiceCoins} practice</Pill>
        </div>

        {/* Tier progress */}
        {home.rank.next ? (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(home.rank.progress * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {home.rank.toNext.toLocaleString()} coins to{" "}
              <span className="text-foreground">{home.rank.next.label}</span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-accent">Top of the board — Legend.</p>
        )}

        {/* Passive Sharp Score */}
        <div className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-muted">Sharp Score</span>
          <span className="font-medium text-foreground">
            Top {SHARP_PCT[tierKey]}% of predictors
            {home.streak > 1 && (
              <span
                className="practice-streak ml-2 inline-block font-bold text-accent"
                style={
                  {
                    "--pulse": `${Math.max(0.42, 1.1 - (home.streak - 2) * 0.13).toFixed(2)}s`,
                  } as React.CSSProperties
                }
              >
                {"🔥".repeat(Math.min(3, Math.floor((home.streak - 1) / 3) + 1))}{" "}
                {home.streak} streak
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Coins-are-score + audio */}
      <div className="arena-panel flex items-center justify-between gap-3">
        <p className="text-[13.5px] leading-[1.5] text-muted">
          Coins are score — they buy nothing &amp; never convert to cash.
        </p>
        <AudioSettings musicTrack="solo" />
      </div>

      <PracticeHomeClient
        busted={busted}
        balance={home.practiceCoins}
        refillAt={profile.practiceRefillAt ?? null}
      />

      {/* Arena — the Parlay round. GREEN (money/play "go"), not orange: the
          one orange primary on this screen is "Host" below. */}
      <Link
        href="/app/practice/arena"
        className="arena-cta flex items-center justify-between p-4"
        style={{ backgroundColor: "#22C55E", color: "#06210F" }}
      >
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">▶ Enter the Arena</span>
          <span className="text-[11.5px] leading-[1.45]" style={{ color: "rgba(6,33,15,0.72)" }}>
            Pick categories, stack multiple slates, play them back-to-back.
          </span>
        </span>
        <span>→</span>
      </Link>

      <Link
        href="/app/practice/create"
        className="flex items-center justify-between rounded-xl border border-accent-border bg-accent-soft p-4 text-accent"
      >
        <span className="font-semibold">＋ Host a practice contest</span>
        <span>→</span>
      </Link>

      <AiCreatorsSection following={profile.followedAiCreators ?? []} />

      {/* Your hosted contests */}
      {home.hosted.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Your contests</h2>
          <ul className="flex flex-col overflow-hidden rounded border border-border">
            {home.hosted.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/practice/${c.id}`}
                  className="flex items-center justify-between bg-surface-card px-4 py-3 hover:bg-surface"
                >
                  <span>
                    <span className="block text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted">
                      Code {c.inviteCode} · {c.entryCount} player
                      {c.entryCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
