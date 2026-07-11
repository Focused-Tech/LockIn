"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, type EntryPick } from "@/lib/firebase/types";
import { Button, Card, Pill } from "@/components/ui";
import { computeSlateMetrics } from "@/lib/contest";
import { CardRushMeta } from "@/components/CardRushMeta";
import { categoryTint, type Tint } from "@/lib/practice/tints";
import {
  EXCLUDED_STATES,
  FREE_ENTRY_COIN_COST,
  type EntryTier,
} from "@/lib/constants";
import type { FeedSlate } from "@/lib/feed";
import type { ShadowEarnings } from "@/server/data/shadowEarnings";
import { AddToParlay } from "@/components/cross-parlay/AddToParlay";
import { formatCents, formatMultiple } from "@/lib/utils";
import { submitEntry } from "./actions";

interface LockedEntry {
  picks: EntryPick[];
  isPaid: boolean;
  score?: number | null;
  rank?: number | null;
  payoutCents?: number | null;
  payoutCoins?: number | null;
}

export function SlatePicker({
  slate,
  coinBalance,
  cashBalanceCents,
  kycVerified,
  registeredState,
  existingEntry,
  shadowEarnings,
}: {
  slate: FeedSlate;
  coinBalance: number;
  cashBalanceCents: number;
  kycVerified: boolean;
  registeredState: string | null;
  existingEntry: LockedEntry | null;
  shadowEarnings?: ShadowEarnings | null;
}) {
  const router = useRouter();
  const { predictions } = slate;
  const tint = categoryTint(slate.category);

  const availableTiers = useMemo(
    () =>
      [...slate.entryTiers]
        .map((t) => t.tier)
        .sort((a, b) => a - b) as EntryTier[],
    [slate.entryTiers],
  );

  const geoBlocked = registeredState
    ? (EXCLUDED_STATES as readonly string[]).includes(registeredState)
    : false;
  const canPaid = kycVerified && !geoBlocked && availableTiers.length > 0;
  const locked = slate.status !== "live";

  const [tier, setTier] = useState<EntryTier>(availableTiers[0] ?? 5);
  const [mode, setMode] = useState<"paid" | "free">(canPaid ? "paid" : "free");
  const [picks, setPicks] = useState<Record<string, "a" | "b">>({});
  const [entryCount, setEntryCount] = useState(slate.entryCount);
  const [lockedEntry, setLockedEntry] = useState<LockedEntry | null>(
    existingEntry,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live prize pool as entries land.
  useEffect(() => {
    const unsub = onSnapshot(
      doc(getDb(), COLLECTIONS.slates, slate.id),
      (snap) => {
        const c = snap.data()?.entryCount;
        if (typeof c === "number") setEntryCount(c);
      },
      () => {},
    );
    return unsub;
  }, [slate.id]);

  const hostingFeeCents =
    slate.entryTiers.find((t) => t.tier === tier)?.hostingFeeCents ?? 0;
  const entryCostCents = tier * 100 + hostingFeeCents;
  const metrics = computeSlateMetrics(
    tier,
    hostingFeeCents,
    entryCount,
    slate.rushMultiplier,
  );

  const rushMeta = slate.isCardRush ? (
    <CardRushMeta
      rushMultiplier={slate.rushMultiplier}
      entryCount={entryCount}
      maxEntries={slate.maxEntries}
      lockTimeMs={locked ? undefined : slate.lockTimeMs}
    />
  ) : null;
  const allPicked = predictions.every((p) => picks[p.id]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    const picksArr: EntryPick[] = predictions.map((p) => ({
      predictionId: p.id,
      choice: picks[p.id]!,
    }));
    const result = await submitEntry({
      slateId: slate.id,
      tier,
      free: mode === "free",
      picks: picksArr,
    });
    setSubmitting(false);
    if (result.ok) {
      setLockedEntry({ picks: picksArr, isPaid: mode === "paid" });
      router.refresh();
    } else {
      setError(result.error);
      // Real-money blocked (age/jurisdiction): surface the specific reason and
      // switch to the practice version so the player can still enter free — no
      // silent fallback, they choose to lock in the free card.
      if (result.code === "not_eligible") setMode("free");
    }
  }

  // ── Live prize pool header (always shown) ───────────────────────────────────
  const poolHeader = (
    <Card className="flex items-center justify-between lg:col-start-2 lg:row-start-1">
      <div>
        <p className="text-xs text-muted">Prize pool</p>
        <p className="text-xl font-semibold text-win">
          {formatCents(metrics.prizePoolCents)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted">1st place</p>
        <p className="text-xl font-semibold">
          {formatCents(metrics.firstPlaceCents)}
          <span className="ml-1 text-sm text-muted">
            {formatMultiple(metrics.firstPlaceMultiple)}
          </span>
        </p>
      </div>
    </Card>
  );

  // ── Already entered / just submitted ────────────────────────────────────────
  if (lockedEntry) {
    const choiceById = new Map(
      lockedEntry.picks.map((p) => [p.predictionId, p.choice]),
    );
    const settled =
      slate.status === "settled" || lockedEntry.score != null;
    const prize =
      (lockedEntry.payoutCents ?? 0) > 0
        ? `Won ${formatCents(lockedEntry.payoutCents!)}`
        : (lockedEntry.payoutCoins ?? 0) > 0
          ? `Won ${lockedEntry.payoutCoins} coins`
          : "No prize this time";

    return (
      <div className="flex flex-col gap-4" data-tour="entry-confirmation">
        {rushMeta}
        {poolHeader}

        {settled ? (
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Final result</p>
              <p className="text-xs text-muted">
                Score {lockedEntry.score ?? 0}
                {lockedEntry.rank ? ` · Rank #${lockedEntry.rank}` : ""}
              </p>
            </div>
            <Pill tone={(lockedEntry.payoutCents ?? 0) > 0 ? "win" : "neutral"}>
              {prize}
            </Pill>
          </Card>
        ) : (
          <Card className="flex items-center gap-2">
            <Pill tone="win">Locked in</Pill>
            <span className="text-sm text-muted">
              {lockedEntry.isPaid ? "Paid entry" : "Free entry"} · good luck.
            </span>
          </Card>
        )}

        {settled &&
          !lockedEntry.isPaid &&
          shadowEarnings &&
          shadowEarnings.wouldHaveWonCents > 0 && (
            <Card className="flex flex-col gap-2 border-accent-border bg-accent-soft">
              <p className="text-sm font-semibold text-accent">
                You played free this time.
              </p>
              <p className="text-sm text-foreground">
                In the ${shadowEarnings.tier} contest, your card would have won{" "}
                <span className="font-semibold text-win">
                  {formatCents(shadowEarnings.wouldHaveWonCents)}
                </span>
                {shadowEarnings.rank
                  ? ` — rank #${shadowEarnings.rank} of ${shadowEarnings.fieldSize}.`
                  : "."}
              </p>
              <Link
                href="/app/wallet"
                className="mt-1 rounded border border-accent-border bg-accent-soft px-4 py-2.5 text-center text-sm font-semibold text-accent"
              >
                Add funds to play for real
              </Link>
            </Card>
          )}

        <div className="flex flex-col gap-3">
          {predictions.map((p) => {
            const choice = choiceById.get(p.id);
            return (
              <Card key={p.id}>
                <p className="mb-2 text-sm font-medium">{p.question}</p>
                <div className="grid grid-cols-2 gap-2">
                  <ReadOnlyOption
                    label={p.optionA}
                    picked={choice === "a"}
                    isResult={p.result === "a"}
                    settled={settled}
                  />
                  <ReadOnlyOption
                    label={p.optionB}
                    picked={choice === "b"}
                    isResult={p.result === "b"}
                    settled={settled}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <Link
          href="/app"
          className="rounded border border-border bg-surface-card px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  // ── Locked slate (results pending) ──────────────────────────────────────────
  if (locked) {
    return (
      <div className="flex flex-col gap-4">
        {rushMeta}
        {poolHeader}
        <Card className="text-sm text-muted">
          This contest is locked — entries are closed and results are pending.
        </Card>
        <Link
          href="/app"
          className="rounded border border-border bg-surface-card px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          Back to Explore
        </Link>
      </div>
    );
  }

  // ── Active pick flow ────────────────────────────────────────────────────────
  // Desktop (≥lg): two columns — predictions left, pick slip (pool + entry +
  // submit) in a 280px right sidebar. Mobile keeps the single-column stack: the
  // lg: grid-placement classes are inert in the flex column, so DOM order (and
  // the mobile layout) is unchanged.
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-6">
      {rushMeta && <div className="lg:col-span-2">{rushMeta}</div>}
      {poolHeader}

      <div
        className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:row-span-6"
        data-tour="prediction-options"
      >
        {predictions.map((p) => (
          <Card key={p.id} style={{ borderColor: tint.border }}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{p.question}</p>
              <Pill tone="ai">AI odds</Pill>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                label={p.optionA}
                prob={p.probA}
                selected={picks[p.id] === "a"}
                tint={tint}
                onClick={() => setPicks((x) => ({ ...x, [p.id]: "a" }))}
              />
              <OptionButton
                label={p.optionB}
                prob={p.probB}
                selected={picks[p.id] === "b"}
                tint={tint}
                onClick={() => setPicks((x) => ({ ...x, [p.id]: "b" }))}
              />
            </div>
            <AddToParlay
              slateId={slate.id}
              slateTitle={slate.title}
              lockTimeMs={slate.lockTimeMs}
              predictionId={p.id}
              question={p.question}
              optionLabel={picks[p.id] === "a" ? p.optionA : p.optionB}
              choice={picks[p.id]}
            />
          </Card>
        ))}
      </div>

      {/* Entry mode */}
      <Card className="flex flex-col gap-3 lg:col-start-2" data-tour="entry-mode">
        <div className="flex rounded-full border border-border p-0.5">
          <ModeTab
            label="Paid"
            active={mode === "paid"}
            disabled={!canPaid}
            onClick={() => setMode("paid")}
          />
          <ModeTab
            label="Free"
            active={mode === "free"}
            onClick={() => setMode("free")}
          />
        </div>

        {mode === "paid" ? (
          <>
            <div className="flex gap-1.5">
              {availableTiers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={
                    "rounded border px-2.5 py-1 text-sm transition-colors " +
                    (tier === t
                      ? "border-accent-border bg-accent-soft text-accent"
                      : "border-border text-muted hover:text-foreground")
                  }
                >
                  ${t}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                Entry {formatCents(tier * 100)} + fee{" "}
                {formatCents(hostingFeeCents)}
              </span>
              <span className="font-semibold">
                {formatCents(entryCostCents)}
              </span>
            </div>
            <p className="text-xs text-muted">
              Cash balance {formatCents(cashBalanceCents)}
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Free entry</span>
            <span className="font-semibold">
              {FREE_ENTRY_COIN_COST} coins
              <span className="ml-1 text-xs text-muted">
                (you have {coinBalance})
              </span>
            </span>
          </div>
        )}

        {!canPaid && (
          <p className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
            {geoBlocked
              ? "Paid contests aren't available in your state — play free with coins."
              : "Verify your identity to unlock paid contests. Free play is open."}
          </p>
        )}
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss lg:col-start-2"
        >
          {error}
        </p>
      )}

      <div data-tour="submit-entry" className="lg:col-start-2">
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={!allPicked || submitting}
          onClick={onSubmit}
        >
          {submitting
            ? "Locking in…"
            : !allPicked
              ? `Pick all ${predictions.length} to enter`
              : mode === "paid"
                ? `Lock in · ${formatCents(entryCostCents)}`
                : `Lock in · ${FREE_ENTRY_COIN_COST} coins`}
        </Button>
      </div>
    </div>
  );
}

function OptionButton({
  label,
  prob,
  selected,
  tint,
  onClick,
}: {
  label: string;
  prob: number;
  selected: boolean;
  tint: Tint;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "flex flex-col gap-1 rounded border px-3 py-2.5 text-left transition-colors " +
        (selected ? "cat-pick-selected" : "border-border bg-surface hover:bg-[#161b25]")
      }
      style={
        selected
          ? ({
              backgroundColor: tint.soft,
              "--cat": tint.color,
            } as React.CSSProperties)
          : undefined
      }
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span
        className={"text-xs " + (selected ? "" : "text-muted")}
        style={selected ? { color: tint.color } : undefined}
      >
        {prob}%
      </span>
    </button>
  );
}

function ReadOnlyOption({
  label,
  picked,
  isResult,
  settled,
}: {
  label: string;
  picked: boolean;
  isResult: boolean;
  settled: boolean;
}) {
  let cls = "border-border text-muted";
  let mark = "";
  if (settled) {
    if (picked && isResult) {
      cls = "border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.10)] text-win";
      mark = "✓";
    } else if (picked && !isResult) {
      cls = "border-[rgba(232,84,84,0.4)] bg-[rgba(232,84,84,0.10)] text-loss";
      mark = "✗";
    } else if (isResult) {
      // The winning option the user didn't pick.
      cls = "border-[rgba(34,197,94,0.4)] text-win";
      mark = "✓";
    }
  } else if (picked) {
    cls = "border-accent-border bg-accent-soft text-accent";
    mark = "✓";
  }

  return (
    <div className={"rounded border px-3 py-2.5 text-sm " + cls}>
      {label}
      {mark && <span className="ml-1 text-xs">{mark}</span>}
    </div>
  );
}

function ModeTab({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex-1 rounded-full px-3 py-1 text-sm transition-colors " +
        (active
          ? "bg-accent-soft text-accent"
          : "text-muted hover:text-foreground") +
        (disabled ? " cursor-not-allowed opacity-40" : "")
      }
    >
      {label}
    </button>
  );
}
