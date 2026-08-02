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
import { categoryTint } from "@/lib/practice/tints";
import { EXCLUDED_STATES, type EntryTier } from "@/lib/constants";
import { PERJURY_ATTESTATION_TEXT } from "@/lib/eligibility";
import type { FeedSlate, FeedPrediction } from "@/lib/feed";
import { SlateCard, type SlateLeg } from "@/components/slate/SlateCard";
import type { ShadowEarnings } from "@/server/data/shadowEarnings";
import { AddToParlay } from "@/components/cross-parlay/AddToParlay";
import { formatCents, formatCentsShort, formatMultiple } from "@/lib/utils";
import { submitEntry, acceptCashAttestation } from "./actions";

// §1.1 — a prediction's pickable options + its pick style. Archetype legs render their N options;
// binary legs render A/B. Milestone COUNT is bucket chips; every other archetype is the contest style.
export function optionsFor(p: FeedPrediction): { key: string; label: string; secondary?: string[] }[] {
  if (p.type === "archetype" && p.options) {
    return p.options.map((o) => ({
      key: o.key,
      label: o.label,
      // §1.2 context lines (season avg + last-out), read-only. NEVER the threshold being predicted.
      secondary: o.seasonAverage ? [o.seasonAverage, o.last3Form].filter(Boolean) as string[] : undefined,
    }));
  }
  // §2.2 — a cross-game h2h option is "Name · Team · 60 hits (season)". Split on " · " so the NAME is
  // the .nm line and each remaining part is its own .cx context line (not one run-on string).
  const split = (key: string, s: string) => {
    const parts = s.split(" · ");
    return { key, label: parts[0]!, secondary: parts.length > 1 ? parts.slice(1) : undefined };
  };
  return [split("a", p.optionA), split("b", p.optionB)];
}
export function pickStyleFor(p: FeedPrediction): "button" | "contest" | "chips" {
  if (p.type !== "archetype") return "button";
  return p.archetype === "milestone_count" ? "chips" : "contest";
}

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
  cashBalanceCents,
  cashAttested,
  registeredState,
  existingEntry,
  shadowEarnings,
}: {
  slate: FeedSlate;
  cashBalanceCents: number;
  /** §2 — whether the player has accepted the residence attestation (the cash-entry gate). */
  cashAttested: boolean;
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

  // §1 — ADVANCED IS CASH ONLY. No paid/free toggle, no coin path (coins are the beginner lane).
  // §2 — the cash-entry gate is geo (registered state) + the penalty-of-perjury attestation. It does
  // NOT require ID/KYC (that's deferred to the withdrawal threshold). `kycVerified` is no longer read.
  const geoBlocked = registeredState
    ? (EXCLUDED_STATES as readonly string[]).includes(registeredState)
    : false;
  const [attested, setAttested] = useState(cashAttested);
  const [attesting, setAttesting] = useState(false);
  const canEnterCash = !geoBlocked && availableTiers.length > 0 && attested;
  const locked = slate.status !== "live";

  const [tier, setTier] = useState<EntryTier>(availableTiers[0] ?? 5);
  const [picks, setPicks] = useState<Record<string, string>>({});
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
  const isPro = predictions.some((p) => p.type === "archetype");
  // §1.2 — a leg whose player stats couldn't load can't be entered; block submit + flag it.
  const contextBlocked = predictions.some((p) => p.contextError);
  // §1.1 — every prediction as a SlateCard leg (N-way for pro, A/B for binary), with §1.2 context.
  const slateLegs: SlateLeg[] = predictions.map((p) => {
    const opts = optionsFor(p);
    return {
      question: p.question,
      qs: p.type === "archetype" ? (p.gameLine ?? undefined) : undefined,
      picks: opts.map((o) => ({ label: o.label, secondary: o.secondary, selected: picks[p.id] === o.key })),
      state: "neutral" as SlateLeg["state"], // playable card — no per-leg grading outline
      pickStyle: pickStyleFor(p),
      flag: p.contextError ? { variant: "bad" as const, message: p.contextError } : null,
    };
  });

  // §2.3 — header sub + badge. §2.5 — the cash balance + affirmation move INSIDE the card as its footer.
  const lockLabel = new Date(slate.lockTimeMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const subLine = `${predictions.length} question${predictions.length === 1 ? "" : "s"} · locks ${lockLabel}`;
  const badgeLabel = `Cash · ${50 - EXCLUDED_STATES.length} states`;
  const entryFooter = (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-xs text-muted">Cash balance {formatCents(cashBalanceCents)}</p>
      {geoBlocked ? (
        <div className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
          Paid contests aren&apos;t available in your state.{" "}
          <Link href="/app/beginner" className="font-semibold text-accent">Play the beginner lane in coins →</Link>
        </div>
      ) : !attested ? (
        <div className="flex flex-col gap-2 rounded border border-border bg-surface px-3 py-2.5">
          <p className="text-xs text-muted">{PERJURY_ATTESTATION_TEXT}</p>
          <Button variant="accent" size="sm" disabled={attesting} onClick={onAttest}>
            {attesting ? "Confirming…" : `I affirm — enter for cash${registeredState ? ` (${registeredState})` : ""}`}
          </Button>
          <p className="text-[11px] text-muted">No ID upload needed to play — identity checks apply only at withdrawal.</p>
        </div>
      ) : null}
      {error && (
        <p role="alert" className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}
    </div>
  );

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
      free: false, // §1 — advanced is cash only
      picks: picksArr,
    });
    setSubmitting(false);
    if (result.ok) {
      setLockedEntry({ picks: picksArr, isPaid: true });
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  // §2 — accept the residence attestation (the cash-entry route). No ID upload; records the perjury
  // attestation, then cash entry unlocks.
  async function onAttest() {
    setError(null);
    setAttesting(true);
    const r = await acceptCashAttestation();
    setAttesting(false);
    if (r.ok) setAttested(true);
    else setError(r.error ?? "Couldn't record your attestation.");
  }

  // ── Live prize pool header (always shown) ───────────────────────────────────
  const poolHeader = (
    <Card className="flex items-center justify-between lg:col-start-2 lg:row-start-1">
      <div>
        <p className="text-xs text-muted">Prize pool</p>
        <p className="text-xl font-semibold text-win">
          {formatCentsShort(metrics.prizePoolCents)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted">1st place</p>
        <p className="text-xl font-semibold">
          {formatCentsShort(metrics.firstPlaceCents)}
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
        ? `Won ${formatCentsShort(lockedEntry.payoutCents!)}`
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
                  {formatCentsShort(shadowEarnings.wouldHaveWonCents)}
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
        {/* §1.1 — the picks render through the ONE SlateCard (N-way for pro, A/B for binary), with
            §1.2 read-only context and §1.3 category bezel + lock-in animation. */}
        <SlateCard
          mode="contest"
          currency="cash"
          catColor={tint.border}
          eyebrow={slate.category}
          title={slate.title}
          sub={subLine}
          badge={badgeLabel}
          legs={slateLegs}
          // §4 — the stake chips + CTA + lock-in live INSIDE the one SlateCard (not a separate panel).
          // §1 — cash only: the $ tiers are the stake chips; they reveal once every leg is answered.
          stakeMode="afterAnswers"
          stakeOptions={availableTiers}
          selectedStake={tier}
          stakeLabel="Entry"
          answered={allPicked}
          onStake={(s) => setTier(s as EntryTier)}
          cta={{
            label: submitting ? "Locking in…" : !allPicked ? `Pick all ${predictions.length} to enter` : `Lock in · ${formatCents(entryCostCents)}`,
            disabled: !allPicked || submitting || contextBlocked || !canEnterCash,
          }}
          onCta={onSubmit}
          locked={locked}
          locking={submitting}
          footer={entryFooter}
          onPick={(li, pi) => {
            const p = predictions[li];
            const key = p && optionsFor(p)[pi]?.key;
            if (p && key) setPicks((x) => ({ ...x, [p.id]: key }));
          }}
        />
        {/* cross-parlay add-in stays available for binary slates (archetype legs aren't parlayable). */}
        {!isPro &&
          predictions.map((p) =>
            picks[p.id] ? (
              <AddToParlay
                key={p.id}
                slateId={slate.id}
                slateTitle={slate.title}
                lockTimeMs={slate.lockTimeMs}
                predictionId={p.id}
                question={p.question}
                optionLabel={picks[p.id] === "a" ? p.optionA : p.optionB}
                choice={picks[p.id] as "a" | "b"}
              />
            ) : null,
          )}
      </div>

    </div>
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
