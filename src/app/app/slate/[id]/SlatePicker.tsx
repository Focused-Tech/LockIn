"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { COLLECTIONS, type EntryPick } from "@/lib/firebase/types";
import { Card, Pill } from "@/components/ui";
import { computeSlateMetrics } from "@/lib/contest";
import { CardRushMeta } from "@/components/CardRushMeta";
import { catColors, catSoft } from "@/lib/categoryColors";
import { LockAnimation } from "@/components/LockAnimation";
import { EXCLUDED_STATES, type EntryTier } from "@/lib/constants";
import type { FeedSlate, FeedPrediction } from "@/lib/feed";
import type { ShadowEarnings } from "@/server/data/shadowEarnings";
import { AddToParlay } from "@/components/cross-parlay/AddToParlay";
import { formatCents, formatCentsShort, formatMultiple } from "@/lib/utils";
import { submitEntry } from "./actions";
import "./slate-detail.css";

// Cash accent (the prize/stake blocks' left edge) — advanced is cash-only.
const CASH = "#2FB98A";
const CASH_DEEP = "#166B4F";

/** Prettify an archetype slug ("head_to_head") into a leg pill label ("Head to head"). */
function archLabel(slug: string): string {
  const s = slug.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A leg's pickable options with the % + context the panel leg card renders. Binary legs carry
 *  the probability (probA / 100−A); archetype legs have no per-option %, so the meter is omitted. */
function legOptions(p: FeedPrediction): { key: string; label: string; cx: string | null; pct: number | null }[] {
  if (p.type === "archetype" && p.options) {
    return p.options.map((o) => ({
      key: o.key,
      label: o.label,
      cx: [o.seasonAverage, o.last3Form].filter(Boolean).join(" · ") || null,
      pct: null,
    }));
  }
  const split = (s: string) => {
    const parts = s.split(" · ");
    return { label: parts[0]!, cx: parts.length > 1 ? parts.slice(1).join(" · ") : null };
  };
  const a = split(p.optionA);
  const b = split(p.optionB);
  return [
    { key: "a", label: a.label, cx: a.cx, pct: Math.round(p.probA) },
    { key: "b", label: b.label, cx: b.cx, pct: Math.round(p.probB) },
  ];
}

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
  isDemo = false,
  demoReplay,
}: {
  slate: FeedSlate;
  cashBalanceCents: number;
  /** §2 — whether the player has accepted the residence attestation (the cash-entry gate). */
  cashAttested: boolean;
  registeredState: string | null;
  existingEntry: LockedEntry | null;
  shadowEarnings?: ShadowEarnings | null;
  /** DEMO slate — free to play through (no cash, no attestation, no DB write); exists so any tester
   *  can experience the pick → lock-in flow + animation without funding a wallet. */
  isDemo?: boolean;
  /** DEMO rotation — after a play, offer a fresh set with one more leg (up to 5). */
  demoReplay?: { nextLegs: number; atMax: boolean; onReplay: () => void };
}) {
  const router = useRouter();
  const { predictions } = slate;
  const [catEdge, catShoulder] = catColors(slate.category);
  const catSoftFill = catSoft(catEdge);

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
  // §2 — the residence attestation now lives at signup + the wallet (not re-confirmed per contest).
  // The slate stays affirmation-free; the server still requires it (verifyForCash). A player who
  // hasn't attested yet is pointed to the wallet rather than gated with perjury text here.
  // DEMO slates bypass the cash/attestation gate entirely — they never move money.
  const canEnterCash = isDemo || (!geoBlocked && availableTiers.length > 0 && cashAttested);
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
  const remaining = predictions.filter((p) => !picks[p.id]).length;

  // LOCK-IN AUDIO — the lock-close click, fired at ~740ms to land as the shackle SEATS. Only while
  // submitting (user-initiated). Matches the tower's lock-in sound.
  useEffect(() => {
    if (!submitting) return;
    let audio: HTMLAudioElement | null = null;
    const t = window.setTimeout(() => {
      audio = new Audio("/sounds/lock-close.mp3");
      audio.play().catch(() => {});
    }, 740);
    return () => {
      window.clearTimeout(t);
      audio?.pause();
    };
  }, [submitting]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    const startedAt = Date.now(); // hold the lock-in animation for its full ~950ms before transitioning
    const picksArr: EntryPick[] = predictions.map((p) => ({
      predictionId: p.id,
      choice: picks[p.id]!,
    }));

    // DEMO — never touches the server or a balance; just plays the lock-in animation through, then
    // shows the "locked in" confirmation so a tester feels the full flow.
    if (isDemo) {
      window.setTimeout(() => {
        setSubmitting(false);
        setLockedEntry({ picks: picksArr, isPaid: false });
      }, 1000);
      return;
    }

    const result = await submitEntry({
      slateId: slate.id,
      tier,
      free: false, // §1 — advanced is cash only
      picks: picksArr,
    });
    if (result.ok) {
      const wait = Math.max(0, 950 - (Date.now() - startedAt));
      window.setTimeout(() => {
        setSubmitting(false);
        setLockedEntry({ picks: picksArr, isPaid: true });
        router.refresh();
      }, wait);
    } else {
      setSubmitting(false);
      setError(result.error);
    }
  }

  // ── Live prize pool block (panel language, cash-green edge) ──────────────────
  const prizeBlock = (
    <div
      className="sd-blk lg:col-start-2 lg:row-start-1"
      style={{ "--sc": CASH, "--scd": CASH_DEEP } as React.CSSProperties}
    >
      <div className="sd-prow">
        <div>
          <span className="k">Prize pool</span>
          <span className="v">{formatCentsShort(metrics.prizePoolCents)}</span>
        </div>
        <div>
          <span className="k">1st place</span>
          <span className="v w">
            {formatCentsShort(metrics.firstPlaceCents)}
            <small>{formatMultiple(metrics.firstPlaceMultiple)}</small>
          </span>
        </div>
        <div className="rt">
          {entryCount.toLocaleString()}
          <b>in</b>
        </div>
      </div>
    </div>
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
        {prizeBlock}

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
              {isDemo
                ? "Demo locked in — nothing was charged."
                : `${lockedEntry.isPaid ? "Paid entry" : "Free entry"} · good luck.`}
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

        {/* DEMO rotation — replay with one more leg (up to 5), fresh questions each time. */}
        {demoReplay && (
          <button type="button" className="sd-lock" onClick={demoReplay.onReplay}>
            {demoReplay.atMax
              ? "Play again · 5 legs, new questions"
              : `Play again · ${demoReplay.nextLegs} legs`}
          </button>
        )}

        <Link
          href="/app"
          className="rounded border border-border bg-surface-card px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          Back to The Floor
        </Link>
      </div>
    );
  }

  // ── Locked slate (results pending) ──────────────────────────────────────────
  if (locked) {
    return (
      <div className="flex flex-col gap-4">
        {rushMeta}
        {prizeBlock}
        <Card className="text-sm text-muted">
          This contest is locked — entries are closed and results are pending.
        </Card>
        <Link
          href="/app"
          className="rounded border border-border bg-surface-card px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          Back to The Floor
        </Link>
      </div>
    );
  }

  // ── Active pick flow (panel language, slate_detail.html) ────────────────────
  // §9 — this does NOT render the tower's shared SlateCard; it's the slate-page-only panel set.
  // Category-coloured leg cards, cash-green prize/stake blocks, one Lock-in CTA disabled until every
  // leg is answered. Desktop: prize/stake ride a 280px right rail; mobile is the single stack.
  const legVars = {
    "--sd-cat": catEdge,
    "--sd-catd": catShoulder,
    "--sd-catsoft": catSoftFill,
  } as React.CSSProperties;

  return (
    <div className="relative flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-6">
      {/* LOCK-IN overlay — the padlock shackle slides down + lock-close click; mounts only while
          submitting so it plays ONCE (the app's LockAnimation, same as the tower's lock-in). */}
      {submitting && (
        <div className="sd-lockfx">
          <LockAnimation size={112} sound={false} />
          <span className="sd-lw">Locking in</span>
        </div>
      )}
      {rushMeta && <div className="lg:col-span-2">{rushMeta}</div>}
      {prizeBlock}

      <div
        className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:row-span-6"
        data-tour="prediction-options"
      >
        <div className="sd-sh">
          The questions
          <span>
            {predictions.length} leg{predictions.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* ONE LEG, ONE CARD — category edge, options with % + context + meter. */}
        {predictions.map((p, i) => {
          const opts = legOptions(p);
          return (
            <div key={p.id} className="sd-leg" style={legVars}>
              <div className="sd-lh">
                <span className="sd-lno">{i + 1}</span>
                {p.archetype && <span className="sd-arch">{archLabel(p.archetype)}</span>}
              </div>
              <div className="sd-q">{p.question}</div>
              {p.gameLine && (
                <div className="mt-1 text-xs text-muted">{p.gameLine}</div>
              )}
              {p.contextError ? (
                <p data-flag="bad" className="mt-2 text-xs text-loss">{p.contextError}</p>
              ) : (
                <div className="sd-opts">
                  {opts.map((o) => {
                    const on = picks[p.id] === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        className={"sd-opt" + (on ? " on" : "")}
                        aria-pressed={on}
                        onClick={() => setPicks((x) => ({ ...x, [p.id]: o.key }))}
                      >
                        <div className="l1">
                          <span className="nm">{o.label}</span>
                          {o.pct != null && <span className="pc">{o.pct}%</span>}
                        </div>
                        {o.cx && <div className="cx">{o.cx}</div>}
                        {o.pct != null && <span className="mtr" style={{ width: `${o.pct}%` }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

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

      {/* stake block — reveals once every leg is answered (cash-green edge). Hidden for demo (free). */}
      {allPicked && !geoBlocked && !isDemo && (
        <div
          className="sd-blk lg:col-start-2"
          style={{ "--sc": CASH, "--scd": CASH_DEEP, "--scsoft": catSoft(CASH, 0.14) } as React.CSSProperties}
        >
          <div className="sd-srow">
            <div>
              <span className="k">Your stake</span>{" "}
              <span className="v">${tier}</span>
            </div>
            <div className="rt">
              <span>To win 1st</span>
              <b>{formatCentsShort(metrics.firstPlaceCents)}</b>
            </div>
          </div>
          <div className="sd-stakes">
            {availableTiers.map((t) => (
              <button
                key={t}
                type="button"
                className={"sd-stk" + (tier === t ? " on" : "")}
                onClick={() => setTier(t)}
              >
                ${t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* geo block — coins fallback; residence attestation lives at signup + wallet now. Demo skips both. */}
      {isDemo ? null : geoBlocked ? (
        <div className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted lg:col-start-2">
          Paid contests aren&apos;t available in your state.{" "}
          <Link href="/app/beginner" className="font-semibold text-accent">Play the beginner lane in coins →</Link>
        </div>
      ) : !cashAttested ? (
        <div className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted lg:col-start-2">
          Confirm your residence in your{" "}
          <Link href="/app/wallet" className="font-semibold text-accent">wallet</Link>{" "}
          to enter for cash.
        </div>
      ) : null}

      {/* Lock in — one CTA, disabled until every leg is answered */}
      <div className="lg:col-start-2">
        <button
          type="button"
          className="sd-lock"
          disabled={!allPicked || submitting || contextBlocked || !canEnterCash}
          onClick={onSubmit}
        >
          {submitting
            ? "Locking in…"
            : !allPicked
              ? `Pick ${remaining} more`
              : isDemo
                ? "Lock in · Demo"
                : `Lock in · ${formatCents(entryCostCents)}`}
        </button>
        <div className="sd-ctasub">
          {isDemo
            ? "Demo contest — free to play through. Nothing leaves your balance."
            : "Entry leaves your balance when the slate locks."}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss lg:col-start-2">
          {error}
        </p>
      )}

      <p className="sd-legal lg:col-start-2">
        Skill-based prediction contest platform. Not gambling. Not sports betting. 18+.
      </p>
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
