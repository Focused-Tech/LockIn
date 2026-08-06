"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { LockGlyph } from "@/components/practice/LockGlyph";
import { toggleFollowCreator } from "@/components/feed/followActions";
import {
  closesLabel,
  type BeginnerCard,
  type BeginnerFeed,
  type BeginnerPick,
} from "@/lib/beginner/types";
import {
  DEFAULT_STAKE,
  MAX_LEGS,
  PAYOUT_MODEL,
  STAKE_OPTIONS,
  isPaidPercentile,
  projectedPercentile,
  resultFor,
  winUpTo,
} from "@/lib/beginner/payoutModel";
import { lockBeginnerEntry } from "./actions";
import { categoryTint } from "@/lib/practice/tints";

const COIN = "🪙";
const coins = (n: number) => `${COIN} ${n}`;

type Screen = "explore" | "pick" | "parlay" | "locked" | "result" | "follow";

interface Leg {
  pick: BeginnerPick;
  choice: "a" | "b";
}

const sideLabel = (leg: Leg) =>
  leg.choice === "a" ? leg.pick.optionA : leg.pick.optionB;
const sideAgree = (leg: Leg) =>
  leg.choice === "a" ? leg.pick.agreeA : leg.pick.agreeB;

export function BeginnerJourney({
  feed,
  coinBalance,
}: {
  feed: BeginnerFeed;
  coinBalance: number;
}) {
  const [balance, setBalance] = useState(coinBalance);
  const [screen, setScreen] = useState<Screen>("explore");
  const [card, setCard] = useState<BeginnerCard | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [stake, setStake] = useState<number>(DEFAULT_STAKE);
  const [landed, setLanded] = useState(1);
  const [lockedWinUpTo, setLockedWinUpTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState<Set<string>>(
    () => new Set(feed.cards.filter((c) => c.isFollowed).map((c) => c.creatorId!)),
  );
  const [pending, startTransition] = useTransition();

  const nowMs = useMemo(() => Date.now(), []);

  // ── flow helpers ───────────────────────────────────────────────────────────
  function startPick(c: BeginnerCard, choice: "a" | "b", pick: BeginnerPick = c.headline) {
    setCard(c);
    setLegs([{ pick, choice }]);
    setStake(DEFAULT_STAKE);
    setError(null);
    setScreen("pick");
  }

  function flipLeg(idx: number) {
    setLegs((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, choice: l.choice === "a" ? "b" : "a" } : l,
      ),
    );
  }

  function removeLeg(idx: number) {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLeg(pick: BeginnerPick) {
    setLegs((prev) =>
      prev.length >= MAX_LEGS ? prev : [...prev, { pick, choice: "a" }],
    );
  }

  function lockIn() {
    if (!card) return;
    setError(null);
    startTransition(async () => {
      const res = await lockBeginnerEntry({
        creatorId: card.creatorId,
        stakeCoins: stake,
        legs: legs.map((l) => ({
          slateId: l.pick.slateId,
          predictionId: l.pick.predictionId,
          choice: l.choice,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBalance(res.newBalance);
      setLockedWinUpTo(res.winUpToCoins);
      setLanded(legs.length);
      setScreen("locked");
    });
  }

  function follow() {
    if (!card || card.isHouse || !card.creatorId) {
      setScreen("follow");
      return;
    }
    const id = card.creatorId;
    setFollowing((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await toggleFollowCreator(id, true);
    });
    setScreen("follow");
  }

  function reset() {
    setScreen("explore");
    setCard(null);
    setLegs([]);
    setStake(DEFAULT_STAKE);
    setError(null);
  }

  // ── header ───────────────────────────────────────────────────────────────
  const header = (
    // Coin balance lives in the app header (TopNav) only — no second pill here (it duplicated the
    // header count and wrapped to two lines).
    <div>
      <h1 className="text-xl font-semibold">Beginner</h1>
      <p className="text-sm text-muted">Simple &amp; guided — coins, not odds.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      {screen === "explore" && (
        <ExploreScreen feed={feed} nowMs={nowMs} onPick={startPick} />
      )}
      {screen === "pick" && card && (
        <PickScreen
          card={card}
          legs={legs}
          stake={stake}
          balance={balance}
          onStake={setStake}
          onMore={() => setScreen("parlay")}
          onLockOne={lockIn}
          onBack={reset}
          pending={pending}
        />
      )}
      {screen === "parlay" && card && (
        <ParlayScreen
          card={card}
          legs={legs}
          stake={stake}
          onFlip={flipLeg}
          onRemove={removeLeg}
          onAdd={addLeg}
          onLock={lockIn}
          onBack={() => setScreen("pick")}
          pending={pending}
          error={error}
        />
      )}
      {screen === "locked" && (
        <LockedScreen
          legs={legs}
          stake={stake}
          winUp={lockedWinUpTo}
          onSee={() => setScreen("result")}
          onBack={reset}
        />
      )}
      {screen === "result" && (
        <ResultScreen
          legs={legs}
          stake={stake}
          landed={landed}
          balanceAfter={balance}
          onLanded={setLanded}
          creatorName={card?.creatorName ?? "this creator"}
          canFollow={!!card && !card.isHouse}
          onFollow={follow}
        />
      )}
      {screen === "follow" && card && (
        <FollowScreen
          card={card}
          isFollowing={!!card.creatorId && following.has(card.creatorId)}
          nowMs={nowMs}
          onDone={reset}
        />
      )}
    </div>
  );
}

// ── Explore ──────────────────────────────────────────────────────────────────
function ExploreScreen({
  feed,
  nowMs,
  onPick,
}: {
  feed: BeginnerFeed;
  nowMs: number;
  onPick: (c: BeginnerCard, choice: "a" | "b", pick?: BeginnerPick) => void;
}) {
  return (
    <div className="flex flex-col gap-4">

      {feed.cards.length === 0 && (
        <div
          className="text-sm text-muted"
          style={{
            borderRadius: 15,
            padding: 15,
            background: "linear-gradient(180deg, #161c25 0%, #10151c 100%)",
            border: "1px solid #232b37",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px rgba(0,0,0,.55)",
          }}
        >
          No live contests right now. Check back soon — new picks drop daily.
        </div>
      )}

      {feed.cards.map((c) => {
        const t = categoryTint(c.headline.category);
        return (
        // §5 — the approved panel language: gradient body, 1px hairline on three sides, 4px LEFT
        // edge in the category colour (with a darker shoulder via the inset glow), radius 15,
        // padding 15, inner highlight + drop shadow. Coins-only throughout (no dollar figure).
        <div
          key={`${c.creatorId ?? "house"}-${c.headline.predictionId}`}
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 15,
            padding: 15,
            background: "linear-gradient(180deg, #161c25 0%, #10151c 100%)",
            border: "1px solid #232b37",
            borderLeft: `4px solid ${t.color}`,
            boxShadow: `inset 6px 0 14px -10px ${t.color}, inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px rgba(0,0,0,.55)`,
            "--cat": t.color,
          } as React.CSSProperties}
        >
          <div className="flex items-center justify-between gap-2">
            <CreatorRow card={c} />
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: t.soft, borderColor: t.border, color: t.color }}
            >
              {c.headline.category}
            </span>
          </div>
          <p className="my-3 text-base font-bold leading-snug">
            {c.headline.question}
          </p>
          <AgreeButton
            label={c.headline.optionA}
            agree={c.headline.agreeA}
            tone="yes"
            onClick={() => onPick(c, "a")}
          />
          <AgreeButton
            label={c.headline.optionB}
            agree={c.headline.agreeB}
            tone="no"
            onClick={() => onPick(c, "b")}
          />
          {c.morePicks.length > 0 && (
            // The game's OTHER markets (spread / total / …) shown INLINE and directly pickable — the
            // card is a full board, not just "who wins". Tapping an option starts the pick on it.
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">More markets</p>
              {c.morePicks.slice(0, 4).map((p) => (
                <div key={`${p.slateId}-${p.predictionId}`} className="rounded-lg border border-border p-2">
                  <div className="mb-1 text-xs font-semibold text-foreground">{p.question}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPick(c, "a", p)}
                      className="min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-left text-xs font-semibold"
                      style={{ borderColor: t.border }}
                    >
                      {p.optionA} <span className="text-muted">· {p.agreeA}%</span>
                    </button>
                    <button
                      onClick={() => onPick(c, "b", p)}
                      className="min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-left text-xs font-semibold"
                      style={{ borderColor: t.border }}
                    >
                      {p.optionB} <span className="text-muted">· {p.agreeB}%</span>
                    </button>
                  </div>
                </div>
              ))}
              {c.morePicks.length > 4 && (
                <button onClick={() => onPick(c, "a")} className="text-left text-xs font-semibold" style={{ color: t.color }}>
                  +{c.morePicks.length - 4} more →
                </button>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-live">
              {COIN} play {DEFAULT_STAKE} · win up to {winUpTo(DEFAULT_STAKE, 1)}
            </span>
            <span className="text-muted">
              {closesLabel(c.headline.lockTimeMs, nowMs)}
            </span>
          </div>
          {/* Full DraftKings-style board (every market on one screen) — the Advanced slate view. */}
          <Link
            href={`/app/slate/${c.headline.slateId}`}
            className="mt-2 block text-center text-xs font-semibold"
            style={{ color: t.color }}
          >
            See the full board →
          </Link>
        </div>
        );
      })}
      <p className="text-center text-xs text-[#3A4A5C]">Tap a pick to try it →</p>
    </div>
  );
}

function CreatorRow({ card }: { card: BeginnerCard }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold " +
          (card.isHouse
            ? "border border-border bg-surface text-muted"
            : "border-[1.5px] border-accent-border bg-accent-soft text-accent")
        }
      >
        {card.initials}
      </div>
      <div>
        <div className="text-sm font-bold">{card.creatorName}</div>
        <div className="text-[11px] text-muted">
          {card.hitRate != null ? (
            <>
              picks hit <b className="text-win">{card.hitRate}%</b>
            </>
          ) : (
            <span className="italic">no track record yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AgreeButton({
  label,
  agree,
  tone,
  onClick,
}: {
  label: string;
  agree: number;
  tone: "yes" | "no";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-[#2A3A4D]"
    >
      <div className="mb-2 flex items-center justify-between text-sm font-bold">
        <span>{label}</span>
        <span className="text-xs font-semibold text-muted">{agree}% agree</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className={
            "h-full rounded-full " + (tone === "yes" ? "bg-win" : "bg-[#3A4A5C]")
          }
          style={{ width: `${agree}%` }}
        />
      </div>
    </button>
  );
}

// ── Single pick ──────────────────────────────────────────────────────────────
function PickScreen({
  card,
  legs,
  stake,
  balance,
  onStake,
  onMore,
  onLockOne,
  onBack,
  pending,
}: {
  card: BeginnerCard;
  legs: Leg[];
  stake: number;
  balance: number;
  onStake: (n: number) => void;
  onMore: () => void;
  onLockOne: () => void;
  onBack: () => void;
  pending: boolean;
}) {
  const leg = legs[0]!;
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="-mb-1 flex items-center gap-1 self-start text-sm font-semibold text-muted"
      >
        ‹ Back to games
      </button>
      <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
        Your pick
      </p>
      <div className="rounded-2xl border border-border bg-surface-card p-4">
        <div className="mb-1.5 text-[11px] text-muted">with {card.creatorName}</div>
        <p className="mb-3 text-base font-bold leading-snug">{leg.pick.question}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">You&apos;re saying</span>
          <span className="text-[15px] font-extrabold text-accent">
            {sideLabel(leg).toUpperCase()}
          </span>
          <span className="text-xs text-muted">
            — {sideAgree(leg)}% of players agree
          </span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-bold text-foreground">How many coins?</div>
        <div className="flex gap-2">
          {STAKE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStake(s)}
              className={
                "flex-1 rounded-xl border py-3 text-[15px] font-bold transition-colors " +
                (s === stake
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border bg-surface text-foreground")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-card p-3.5">
        <Row label="You put in" value={coins(stake)} />
        <Row label="Coins left after" value={coins(Math.max(0, balance - stake))} />
        <div className="mt-1 border-t border-border pt-2">
          <Row label="Win up to" value={coins(winUpTo(stake, 1))} valueClass="text-win" />
        </div>
      </div>

      <div className="rounded-2xl border border-accent-border bg-[rgba(255,59,0,.06)] p-4 text-sm text-foreground">
        <b>Heads up:</b> one pick alone usually lands you outside the winning{" "}
        {PAYOUT_MODEL.PAID_LINE}%. Next, we&apos;ll show how stacking a few picks
        grows what you can win — totally optional.
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onMore} disabled={pending}>
          Show me how to win more
        </PrimaryButton>
        <GhostButton onClick={onLockOne} disabled={pending}>
          {pending ? "Locking in…" : "Lock in just this one"}
        </GhostButton>
      </div>
    </div>
  );
}

// ── Parlay ladder ────────────────────────────────────────────────────────────
function ParlayScreen({
  card,
  legs,
  stake,
  onFlip,
  onRemove,
  onAdd,
  onLock,
  onBack,
  pending,
  error,
}: {
  card: BeginnerCard;
  legs: Leg[];
  stake: number;
  onFlip: (i: number) => void;
  onRemove: (i: number) => void;
  onAdd: (p: BeginnerPick) => void;
  onLock: () => void;
  onBack: () => void;
  pending: boolean;
  error: string | null;
}) {
  const usedIds = new Set(legs.map((l) => l.pick.predictionId));
  const addable = card.morePicks.filter((p) => !usedIds.has(p.predictionId));
  const pct = projectedPercentile(legs.length);
  const inPaid = isPaidPercentile(pct);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
          How you reach the winning {PAYOUT_MODEL.PAID_LINE}%
        </p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-extrabold">
          Make it count
          <span className="rounded border border-[rgba(232,161,78,.25)] bg-[rgba(232,161,78,.10)] px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-live">
            DEMO MATH — TUNABLE
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted">
          Add a few more of {card.creatorName}&apos;s picks. Each correct call
          stacks — more right means a higher rank and a bigger share. One is fine.
        </p>
      </div>

      {/* legs — each call is flippable yes/no */}
      <div className="flex flex-col gap-1.5">
        {legs.map((leg, idx) => (
          <div
            key={leg.pick.predictionId}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-extrabold text-accent">
              {idx + 1}
            </div>
            <div className="flex-1 text-xs font-semibold leading-tight">
              {leg.pick.question}
            </div>
            <button
              type="button"
              onClick={() => onFlip(idx)}
              className="rounded-md border border-accent-border bg-accent-soft px-2 py-1 text-[11px] font-bold text-accent"
              aria-label="Flip your call"
            >
              {sideLabel(leg)} ⇄
            </button>
            {idx !== 0 && (
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="p-1 text-[11px] text-muted"
              >
                remove
              </button>
            )}
          </div>
        ))}
      </div>

      {/* add row */}
      {legs.length < MAX_LEGS ? (
        addable.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {addable.map((p) => (
              <div
                key={p.predictionId}
                className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#2A3A4D] px-3 py-2.5"
              >
                <div className="flex-1 text-xs font-semibold text-muted">
                  {p.question}
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(p)}
                  className="rounded-md border border-accent-border bg-accent-soft px-2.5 py-1.5 text-[11px] font-bold text-accent"
                >
                  + add
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-[#3A4A5C]">
            No more open picks from {card.creatorName} right now.
          </p>
        )
      ) : (
        <p className="text-center text-xs text-[#3A4A5C]">
          Max {MAX_LEGS} picks in the beginner lane.
        </p>
      )}

      {/* growth row */}
      <div className="mt-2 text-xs font-bold text-foreground">
        What you could win as you stack
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((n) => {
          const on = n === legs.length;
          return (
            <div
              key={n}
              className={
                "flex-1 rounded-lg border py-2 text-center " +
                (on
                  ? "border-[rgba(34,197,94,.28)] bg-[rgba(34,197,94,.12)]"
                  : "border-border bg-surface")
              }
            >
              <div className={"text-[8px] font-semibold " + (on ? "text-win" : "text-muted")}>
                {n} {n > 1 ? "picks" : "pick"}
              </div>
              <div className="mt-0.5 text-[13px] font-extrabold text-win">
                {winUpTo(stake, n)}
              </div>
            </div>
          );
        })}
      </div>

      {/* paid meter */}
      <div className="mt-2 text-xs font-bold text-foreground">
        Where you&apos;d land if they all hit
      </div>
      <div className="relative mt-1 h-8 overflow-hidden rounded-lg border border-border bg-surface">
        <div
          className="absolute inset-y-0 left-0 border-r-[1.5px] border-dashed border-[rgba(34,197,94,.28)] bg-[rgba(34,197,94,.12)]"
          style={{ width: `${PAYOUT_MODEL.PAID_LINE}%` }}
        />
        <div className="absolute left-1.5 top-1.5 text-[8px] font-bold text-win">
          PAID · top {PAYOUT_MODEL.PAID_LINE}%
        </div>
        <div
          className="absolute inset-y-1 w-[3px] rounded-sm transition-all"
          style={{
            left: `${pct}%`,
            background: inPaid ? "#22C55E" : "#FF3B00",
          }}
        />
      </div>
      <p className="text-xs text-[#3A4A5C]">
        {inPaid
          ? `If all ${legs.length} land, you clear the paid line. Miss one and you slide back toward the unpaid ${100 - PAYOUT_MODEL.PAID_LINE}%.`
          : "One all-correct pick still usually misses the paid line. Add another to climb in."}
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {error && (
          <div className="rounded-lg border border-[#E85454] bg-[#E85454]/10 px-3 py-2 text-center text-sm font-semibold text-[#E85454]">
            {error}
          </div>
        )}
        <PrimaryButton onClick={onLock} disabled={pending}>
          {pending
            ? "Locking in…"
            : `Lock in ${legs.length} ${legs.length > 1 ? "picks" : "pick"}`}
        </PrimaryButton>
        <GhostButton onClick={onBack} disabled={pending}>
          Back
        </GhostButton>
      </div>
    </div>
  );
}

// ── Locked ───────────────────────────────────────────────────────────────────
function LockedScreen({
  legs,
  stake,
  winUp,
  onSee,
  onBack,
}: {
  legs: Leg[];
  stake: number;
  winUp: number;
  onSee: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-center">
      <div className="flex justify-center">
        <LockGlyph size={52} />
      </div>
      <h2 className="text-xl font-extrabold">You&apos;re locked in.</h2>
      <p className="text-sm text-muted">
        Your coins are in. We&apos;ll tell you the moment it settles — nothing else
        to do.
      </p>
      <div className="rounded-2xl border border-border bg-surface-card p-3.5 text-left">
        <Row
          label="Your entry"
          value={`${legs.length} ${legs.length > 1 ? "picks (combo)" : "pick"}`}
        />
        <Row label="Coins in" value={coins(stake)} />
        <Row label="Win up to" value={coins(winUp)} valueClass="text-win" />
      </div>
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onSee}>See what happens</PrimaryButton>
        <GhostButton onClick={onBack}>Back to picks</GhostButton>
      </div>
    </div>
  );
}

// ── Result (illustrative demo stepper) ───────────────────────────────────────
function ResultScreen({
  legs,
  stake,
  landed,
  balanceAfter,
  onLanded,
  creatorName,
  canFollow,
  onFollow,
}: {
  legs: Leg[];
  stake: number;
  landed: number;
  balanceAfter: number;
  onLanded: (n: number) => void;
  creatorName: string;
  canFollow: boolean;
  onFollow: () => void;
}) {
  const n = legs.length;
  const safeLanded = Math.max(0, Math.min(landed, n));
  const r = resultFor(stake, n, safeLanded);
  // balanceAfter already reflects the stake debit; paid entries credit on top.
  const newBalance = balanceAfter + (r.paid ? r.creditedCoins : 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs text-[#3A4A5C]">
        Illustrative — drag how many of your picks landed:
      </p>
      <div className="flex items-center justify-center gap-4">
        <StepBtn onClick={() => onLanded(Math.max(0, safeLanded - 1))}>−</StepBtn>
        <div className="text-center">
          <div className="text-[15px] font-extrabold">
            {safeLanded} of {n} landed
          </div>
          <div className="text-xs text-muted">tap − / +</div>
        </div>
        <StepBtn onClick={() => onLanded(Math.min(n, safeLanded + 1))}>+</StepBtn>
      </div>

      <div className="my-1 text-center">
        {r.paid ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,.28)] bg-[rgba(34,197,94,.12)] px-3 py-1.5 text-xs font-bold text-win">
            ✓ Paid · top {r.pct}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(232,161,78,.25)] bg-[rgba(232,161,78,.10)] px-3 py-1.5 text-xs font-bold text-live">
            Outside the paid {PAYOUT_MODEL.PAID_LINE}% · ~{r.pct}%
          </span>
        )}
        <div
          className={
            "mt-3 text-4xl font-extrabold " +
            (r.paid ? "text-win" : "text-live")
          }
        >
          {r.paid ? `+${r.creditedCoins} ${COIN}` : `−${stake} ${COIN}`}
        </div>
        <p className="mt-2 text-sm text-muted">
          {r.paid
            ? safeLanded === n
              ? `You nailed all ${n}. That ranks you high in the paid ${PAYOUT_MODEL.PAID_LINE}%.`
              : `You hit ${safeLanded} of ${n} — enough to land inside the paid ${PAYOUT_MODEL.PAID_LINE}%.`
            : `${safeLanded === 0 ? "None landed this time." : `Only ${safeLanded} of ${n} landed — short of the winning ${PAYOUT_MODEL.PAID_LINE}%.`} That's how the pool works.`}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface-card p-3.5">
        <Row label="Coins before" value={coins(balanceAfter)} />
        <Row
          label={r.paid ? "You won" : "This entry"}
          value={r.paid ? `+${r.creditedCoins}` : `−${stake}`}
          valueClass={r.paid ? "text-win" : "text-live"}
        />
        <div className="mt-1 border-t border-border pt-2">
          <Row label="New balance" value={coins(newBalance)} valueClass="text-live" />
        </div>
      </div>

      {/* §5 — COINS ONLY: the "if this had been a cash pool" dollar preview is removed from the
          beginner lane (no dollar figure renders anywhere in beginner). The cash-conversion nudge
          lives on the advanced/wallet surfaces, not here. */}

      {canFollow ? (
        <PrimaryButton onClick={onFollow}>Follow {creatorName} for more</PrimaryButton>
      ) : (
        <PrimaryButton onClick={onFollow}>Continue</PrimaryButton>
      )}
    </div>
  );
}

// ── Follow + creator nudge ───────────────────────────────────────────────────
function FollowScreen({
  card,
  isFollowing,
  nowMs,
  onDone,
}: {
  card: BeginnerCard;
  isFollowing: boolean;
  nowMs: number;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-accent-border bg-surface-card p-4 text-center">
        <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-accent-border bg-accent-soft text-[13px] font-extrabold text-accent">
          {card.initials}
        </div>
        {!card.isHouse && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
            {isFollowing ? "✓ Following" : "Follow"} {card.creatorName}
          </span>
        )}
        <p className="mt-2.5 text-sm text-muted">
          {card.isHouse
            ? "You'll see fresh LockIn picks at the top of your feed."
            : `You'll see ${card.creatorName}'s new picks first, right at the top of your feed.`}
        </p>
      </div>

      {card.morePicks.length > 0 && (
        <>
          <div className="text-xs font-bold text-foreground">
            {card.creatorName}&apos;s open picks
          </div>
          {card.morePicks.map((p) => (
            <div
              key={p.predictionId}
              className="flex items-center justify-between rounded-xl border border-border bg-surface-card px-3.5 py-3"
            >
              <span className="text-[13px] font-semibold">{p.question}</span>
              <span className="text-xs text-muted">{p.agreeA}% yes</span>
            </div>
          ))}
        </>
      )}

      <div className="rounded-2xl border border-[rgba(155,93,229,.28)] bg-[rgba(155,93,229,.10)] p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9B5DE5]">
          Getting the hang of it?
        </div>
        <div className="mb-1.5 text-base font-bold">
          People follow creators who call it right.
        </div>
        <p className="text-xs text-muted">
          You&apos;re building a track record. When you&apos;re ready, make your own
          picks, bring your following, and earn a cut when they play.
        </p>
      </div>

      <PrimaryButton onClick={onDone}>Back to picks</PrimaryButton>
      <p className="text-center text-[10px] text-[#3A4A5C]">
        {closesLabel(card.headline.lockTimeMs, nowMs)}
      </p>
    </div>
  );
}

// ── small shared bits ────────────────────────────────────────────────────────
function Row({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className={"font-bold " + valueClass}>{value}</span>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="accent"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function GhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function StepBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 w-9 rounded-lg border border-border bg-surface text-lg font-bold text-foreground"
    >
      {children}
    </button>
  );
}
