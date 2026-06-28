"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/components/ui";
import { RankBadge } from "@/components/practice/RankBadge";
import type { PracticeContestView } from "@/server/data/practice";
import { PRACTICE_CONFIG, type PracticeTierKey } from "@/lib/practice/config";
import { submitPracticePicks } from "../actions";

type Choice = "a" | "b";

export function PracticeContest({
  view,
  isHost,
  funnelEligible,
}: {
  view: PracticeContestView;
  isHost: boolean;
  funnelEligible: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [copied, setCopied] = useState(false);

  const played = view.myEntry !== null;
  const allPicked = view.legs.every((l) => picks[l.id]);

  // Funnel nudge: earned + rare. Only after a WIN, and capped per session via
  // PRACTICE_CONFIG.nudge.perSessionCap so it's never naggy.
  const [showNudge, setShowNudge] = useState(false);
  const nudgeBase = played && !!view.myEntry?.won && funnelEligible;
  useEffect(() => {
    if (!nudgeBase) return;
    try {
      const key = "lockin.practiceNudges";
      const seen = Number(sessionStorage.getItem(key) ?? "0");
      if (seen < PRACTICE_CONFIG.nudge.perSessionCap) {
        sessionStorage.setItem(key, String(seen + 1));
        setShowNudge(true);
      }
    } catch {
      setShowNudge(true);
    }
  }, [nudgeBase]);

  const shareLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/practice/${view.id}`
      : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const ordered = view.legs.map((l) => picks[l.id]!) as Choice[];
      const res = await submitPracticePicks(view.id, ordered);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Pill tone="accent">{view.category}</Pill>
          <Pill tone="neutral">practice · play-money</Pill>
        </div>
        <h1 className="text-xl font-semibold">{view.title}</h1>
        <p className="text-sm text-muted">
          Hosted by @{view.hostUsername} · {view.entryCount} player
          {view.entryCount === 1 ? "" : "s"} · {view.stakeCoins} coin stake
          (score)
        </p>
      </div>

      {/* Invite */}
      <Card className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">Invite friends — code</p>
          <p className="text-lg font-bold tracking-widest text-accent">
            {view.inviteCode}
          </p>
        </div>
        <Button variant="neutral" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </Card>

      {/* Pick card (not yet played) */}
      {!played && (
        <Card className="flex flex-col gap-3">
          {view.legs.map((l, i) => {
            const pick = picks[l.id];
            return (
              <div key={l.id} className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  <span className="text-muted">{i + 1}.</span> {l.question}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["a", "b"] as const).map((side) => {
                    const label = side === "a" ? l.optionA : l.optionB;
                    const prob = side === "a" ? l.probA : l.probB;
                    const on = pick === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setPicks((p) => ({ ...p, [l.id]: side }))}
                        aria-pressed={on}
                        className={
                          "flex flex-col gap-0.5 rounded border px-3 py-2 text-left transition-colors " +
                          (on
                            ? "border-accent-border bg-accent-soft"
                            : "border-border bg-surface hover:bg-surface-card")
                        }
                      >
                        <span className="text-sm font-medium">{label}</span>
                        <span
                          className={
                            "text-xs " + (on ? "text-accent" : "text-muted")
                          }
                        >
                          {prob}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button
            variant="accent"
            size="lg"
            disabled={pending || !allPicked}
            onClick={submit}
          >
            {pending ? "Locking in…" : allPicked ? "Lock in picks" : "Pick every leg"}
          </Button>
          <p className="text-center text-[11px] text-muted">
            Coins are score for rank &amp; bragging rights — they buy nothing and
            never convert to cash.
          </p>
        </Card>
      )}

      {/* Result (played) */}
      {played && view.myEntry && view.reveal && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {view.myEntry.correct}/{view.legs.length} correct
            </span>
            <Pill tone={view.myEntry.won ? "win" : "loss"}>
              {view.myEntry.netCoins >= 0 ? "+" : ""}
              {view.myEntry.netCoins} coins
            </Pill>
          </div>
          <div className="flex flex-col gap-1.5">
            {view.legs.map((l, i) => {
              const hit = view.reveal!.hits[i];
              const correctSide = view.reveal!.outcomes[i];
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded border border-border px-3 py-1.5 text-sm"
                >
                  <span className="truncate">
                    {hit ? "✓" : "✗"} {l.question}
                  </span>
                  <span className="shrink-0 pl-2 text-xs text-muted">
                    {correctSide === "a" ? l.optionA : l.optionB}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Funnel nudge — earned, rare, recognition-framed, grants nothing */}
      {showNudge && (
        <Link
          href="/app/create"
          className="flex items-center justify-between rounded-xl border border-accent-border bg-accent-soft p-4"
        >
          <span className="text-sm">
            <span className="block font-semibold text-accent">
              You&apos;re in the top tier of predictors.
            </span>
            <span className="block text-xs text-muted">
              Ready to host a real creator slate?
            </span>
          </span>
          <span className="text-accent">→</span>
        </Link>
      )}

      {/* Leaderboard */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Leaderboard</h2>
        {view.leaderboard.length === 0 ? (
          <p className="rounded border border-border bg-surface-card px-4 py-6 text-center text-sm text-muted">
            No players yet — share the code to start the competition.
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded border border-border">
            {view.leaderboard.map((row, i) => (
              <li
                key={row.userId}
                className="flex items-center justify-between bg-surface-card px-4 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-sm text-muted">{i + 1}</span>
                  <span className="text-sm font-medium">@{row.username}</span>
                  <RankBadge
                    tier={row.tier as PracticeTierKey}
                    label={row.tier}
                  />
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {row.score}/{view.legs.length}
                  <span
                    className={
                      "ml-2 text-xs " +
                      (row.netCoins >= 0 ? "text-win" : "text-loss")
                    }
                  >
                    {row.netCoins >= 0 ? "+" : ""}
                    {row.netCoins}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isHost && !played && (
        <p className="text-center text-xs text-muted">
          You&apos;re the host — lock in your own picks above to compete too.
        </p>
      )}
    </div>
  );
}
