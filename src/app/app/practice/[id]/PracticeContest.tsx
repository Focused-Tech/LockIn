"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/components/ui";
import { RankBadge } from "@/components/practice/RankBadge";
import type { PracticeContestView } from "@/server/data/practice";
import { PRACTICE_CONFIG, type PracticeTierKey } from "@/lib/practice/config";
import { playSound } from "@/lib/practice/sound";
import { PracticeMusic } from "@/components/practice/PracticeMusic";
import { AiBadge } from "@/components/practice/AiBadge";
import { LegPicker } from "@/components/practice/LegPicker";
import { SpotRace } from "./SpotRace";
import { submitPracticePicks, createPracticeContest } from "../actions";
import {
  PracticeResultAnimation,
  type PlayedResult,
} from "./PracticeResultAnimation";

type Choice = "a" | "b";

export function PracticeContest({
  view,
  isHost,
  funnelEligible,
  canStake,
  refillAt,
}: {
  view: PracticeContestView;
  isHost: boolean;
  funnelEligible: boolean;
  canStake: boolean;
  refillAt: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nextPending, startNext] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Choice>>({});
  const [anim, setAnim] = useState<PlayedResult | null>(null);
  const [sealing, setSealing] = useState(false); // whole-slate lock-in flourish

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

  function submit() {
    setError(null);
    // The decisive commit: seal the whole slate (legs snap + sweep + sound),
    // hold the flourish a beat, then hand off to the settlement reveal.
    setSealing(true);
    playSound("lockin");
    const startedAt = performance.now();
    startTransition(async () => {
      const ordered = view.legs.map((l) => picks[l.id]!) as Choice[];
      const res = await submitPracticePicks(view.id, ordered);
      if (res.ok) {
        // Shape the per-leg reveal for the leg-by-leg settlement animation.
        const revealLegs = view.legs.map((l, i) => ({
          question: l.question,
          pickedLabel: ordered[i] === "a" ? l.optionA : l.optionB,
          correctLabel: res.outcomes[i] === "a" ? l.optionA : l.optionB,
          hit: res.hits[i] ?? false,
        }));
        const wait = Math.max(
          0,
          PRACTICE_CONFIG.audio.sealMinMs - (performance.now() - startedAt),
        );
        setTimeout(() => {
          setSealing(false);
          setAnim({ ...res, revealLegs }); // play the juice, then into next round
        }, wait);
      } else {
        setSealing(false);
        setError(res.error);
      }
    });
  }

  // The "one more" loop: spin up a fresh AI round in the SAME category and jump
  // straight into it — no detour back through the arena.
  function nextRound() {
    setNextError(null);
    startNext(async () => {
      const res = await createPracticeContest({
        category: view.category,
        mode: "ai",
      });
      if (res.ok) {
        setAnim(null);
        router.push(`/app/practice/${res.contestId}`);
      } else setNextError(res.error);
    });
  }

  const refillCountdown = () => {
    if (refillAt == null) return "tomorrow";
    const ms = refillAt - Date.now();
    if (ms <= 0) return "now";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="flex flex-col gap-4">
      <PracticeMusic track="multiplayer" />
      {anim && (
        <PracticeResultAnimation
          result={anim}
          onContinue={() => {
            setAnim(null);
            router.refresh();
          }}
          onNextRound={nextRound}
          nextPending={nextPending}
          nextError={nextError}
        />
      )}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Pill tone="accent">{view.category}</Pill>
          <Pill tone="neutral">practice · play-money</Pill>
        </div>
        <h1 className="text-xl font-semibold">{view.title}</h1>
        {view.aiCreator ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
              style={{
                backgroundColor: `${view.aiCreator.accent}1F`,
                border: `1px solid ${view.aiCreator.accent}66`,
              }}
            >
              {view.aiCreator.avatar}
            </span>
            <span className="font-medium text-foreground">
              {view.aiCreator.name}
            </span>
            <AiBadge />
            <span>· {view.entryCount} played · {view.stakeCoins} coin stake (score)</span>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Hosted by @{view.hostUsername} · {view.entryCount} player
            {view.entryCount === 1 ? "" : "s"} · {view.stakeCoins} coin stake
            (score)
          </p>
        )}
      </div>

      {/* Busted — can browse + see the leaderboard, just can't stake until refill */}
      {!played && !canStake && (
        <Card className="flex flex-col gap-1.5 border-loss-border bg-loss-soft">
          <p className="text-sm font-semibold text-loss">
            Out of practice coins — refills in {refillCountdown()}
          </p>
          <p className="text-xs text-muted">
            Your free daily top-up to 500 is on the way. You can still browse this
            contest and watch the leaderboard; you just can&apos;t lock in picks
            until then. Coins are never buyable with real money.
          </p>
        </Card>
      )}

      {/* Countdown + spot race — drives "lock in before the bots take the good
          spots". Shown only while the player can still stake. */}
      {!played && canStake && view.urgency && (
        <SpotRace
          startAt={view.urgency.startAt}
          lockAt={view.urgency.lockAt}
          seed={view.id}
        />
      )}

      {/* Pick card (not yet played, has coins to stake) */}
      {!played && canStake && (
        <Card
          className={
            "relative flex flex-col gap-3 overflow-hidden " +
            (sealing ? "practice-lockin-flash" : "")
          }
        >
          {/* Lock-in light sweep across the whole slate */}
          {sealing && (
            <div className="practice-lockin-sweep pointer-events-none absolute inset-y-0 left-0 z-10 w-2/5 bg-gradient-to-r from-transparent via-[rgba(255,59,0,0.28)] to-transparent" />
          )}

          {/* Legs scroll as a list; picking a side swipes the card away under a
              closing lock (LegPicker). Picks flow up to drive lock-in. */}
          <LegPicker legs={view.legs} onChange={setPicks} disabled={sealing} />
          {error && <p className="text-sm text-loss">{error}</p>}
          <Button
            variant="accent"
            size="lg"
            disabled={pending || sealing || !allPicked}
            onClick={submit}
          >
            {pending || sealing
              ? "Locking in…"
              : allPicked
                ? "Lock in picks"
                : "Pick every leg"}
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

          {/* The "one more" loop — Next round is the loudest thing on the results
              screen; changing category / leaving the arena are the quiet outs. */}
          <Button
            variant="accent"
            size="lg"
            className="mt-1 w-full"
            disabled={nextPending}
            onClick={nextRound}
          >
            {nextPending
              ? "Dealing next round…"
              : view.myEntry.won
                ? "Next round →"
                : "Run it back →"}
          </Button>
          {nextError && (
            <p className="text-center text-sm text-loss">{nextError}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link
              href="/app/practice/create"
              className="text-muted hover:text-foreground"
            >
              Change category
            </Link>
            <span className="text-border">·</span>
            <Link
              href="/app/practice"
              className="text-muted hover:text-foreground"
            >
              Back to arena
            </Link>
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
