import Link from "next/link";
import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { RankBadge } from "@/components/practice/RankBadge";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { fetchPracticeHome } from "@/server/data/practice";
import { PRACTICE_REFILL_THRESHOLD } from "@/lib/practice/scoring";
import { PRACTICE_CONFIG, type PracticeTierKey } from "@/lib/practice/config";
import { PracticeHomeClient } from "./PracticeHomeClient";

const SHARP_PCT = PRACTICE_CONFIG.sharpPercentile;

export default async function PracticeHomePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const home = await fetchPracticeHome(adminDb(), profile.id, profile);
  const tierKey = home.rank.tier.key as PracticeTierKey;
  const busted = home.practiceCoins <= PRACTICE_REFILL_THRESHOLD;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Practice arena</h1>
        <p className="text-sm text-muted">
          Compete with friends for coins, rank, and bragging rights.{" "}
          <span className="text-foreground">Play-money only</span> — coins are
          score; they buy nothing and never convert to cash.
        </p>
      </div>

      {/* Rank + coins */}
      <Card className="flex flex-col gap-3">
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
              <span className="ml-2 text-accent">🔥 {home.streak} streak</span>
            )}
          </span>
        </div>
      </Card>

      <PracticeHomeClient busted={busted} balance={home.practiceCoins} />

      <Link
        href="/app/practice/create"
        className="flex items-center justify-between rounded-xl border border-accent-border bg-accent-soft p-4 text-accent"
      >
        <span className="font-semibold">＋ Host a practice contest</span>
        <span>→</span>
      </Link>

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
