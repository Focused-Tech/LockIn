"use client";

/**
 * FOX PIT — boss-journey COIN game (self-contained). Runs a room's full round
 * sequence: each round DEALS 5 slates, you KEEP at least Keep-N (one redeal of the
 * rest), then PLAY all 5 with coin stakes; round score is $-weighted (sum of stakes
 * on won slates) and compared to the boss's simulated score. Uses only the Fox Pit
 * slate engine — no real-money / Explore / practice-arena data.
 */
import { useEffect, useRef, useState } from "react";
import { LockGlyph } from "@/components/practice/LockGlyph";
import { categoryTint } from "@/lib/practice/tints";
import { roomByKey, type FoxPitRoomKey } from "@/lib/foxpit";
import { ROOM_RULES, keepNFor, SLATES_PER_ROUND, REDEALS_PER_ROUND, FOXPIT_BUILD_VERSION, CATEGORY_TINT_KEY, TIMERS } from "@/lib/foxpit/rules";
import { dealFoxSlates, roundScore, bossRoundScore, type FoxSlate } from "@/lib/foxpit/slates";

/** A slate is LOCKED once it's staked and every question is answered. */
function isLocked(s: FoxSlate, picks: Record<string, "a" | "b">): boolean {
  return s.stake != null && s.questions.every((q) => picks[q.id] != null);
}
/** The app-wide category color canon for a Fox Pit slate. */
function slateTint(s: FoxSlate) {
  return categoryTint(CATEGORY_TINT_KEY[s.category]);
}

type Phase = "deal" | "play" | "roundResult" | "roomResult";

export function FoxPitGame({
  roomKey,
  onExit,
  onCleared,
}: {
  roomKey: FoxPitRoomKey;
  onExit: () => void;
  onCleared: () => void;
}) {
  const rules = ROOM_RULES[roomKey];
  const room = roomByKey(roomKey);
  const accent = room.accent;

  const [phase, setPhase] = useState<Phase>("deal");
  const [roundIndex, setRoundIndex] = useState(0);
  const [slates, setSlates] = useState<FoxSlate[]>(() => dealFoxSlates(roomKey));
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [redealsLeft, setRedealsLeft] = useState(REDEALS_PER_ROUND);
  const [picks, setPicks] = useState<Record<string, "a" | "b">>({});
  const [roundsWon, setRoundsWon] = useState(0);
  const [last, setLast] = useState<{ you: number; boss: number; won: boolean } | null>(null);

  const keepN = keepNFor(roomKey, roundIndex);

  /* ------- DEAL / keep-N ------- */
  const toggleKeep = (id: string) => {
    setKept((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const redeal = () => {
    if (redealsLeft <= 0) return;
    const fresh = dealFoxSlates(roomKey);
    let fi = 0;
    setSlates((prev) => prev.map((s) => (kept.has(s.id) ? s : fresh[fi++]!)));
    setRedealsLeft((r) => r - 1);
  };

  /** `force` = the decision clock ran out: whatever is in hand locks in and the
   *  game begins (no keep-N gate at that point). */
  const startPlay = (force = false) => {
    if (!force && kept.size < keepN) return;
    setPhase("play");
  };

  /* ------- PLAY ------- */
  const setStake = (slateId: string, stake: number) =>
    setSlates((prev) => prev.map((s) => (s.id === slateId ? { ...s, stake } : s)));
  const pick = (qid: string, side: "a" | "b") => setPicks((p) => ({ ...p, [qid]: side }));

  const allStaked = slates.every((s) => s.stake != null);
  const allAnswered = slates.every((s) => s.questions.every((q) => picks[q.id] != null));
  const canLock = allStaked && allAnswered;

  const lockRound = () => {
    const you = roundScore(slates, picks);
    const boss = bossRoundScore(roomKey);
    const won = you >= boss;
    setLast({ you, boss, won });
    if (won) setRoundsWon((w) => w + 1);
    setPhase("roundResult");
  };

  const nextRound = () => {
    if (roundIndex + 1 >= rules.rounds) {
      setPhase("roomResult");
      return;
    }
    setRoundIndex((r) => r + 1);
    setSlates(dealFoxSlates(roomKey));
    setKept(new Set());
    setRedealsLeft(REDEALS_PER_ROUND);
    setPicks({});
    setLast(null);
    setPhase("deal");
  };

  const cleared = roundsWon > rules.rounds / 2;

  return (
    <div className="fixed inset-0 z-[67] flex flex-col overflow-y-auto bg-background text-foreground">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3">
        <button onClick={onExit} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-muted">
          ‹ Leave
        </button>
        <div className="flex-1 text-center">
          <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>
            {rules.boss.toUpperCase()} · ROUND {roundIndex + 1} / {rules.rounds}
          </div>
          <div className="text-[11px] font-semibold text-muted">
            KEEP {keepN} of {SLATES_PER_ROUND} · coins only
          </div>
        </div>
        <div className="text-right text-[10px] leading-tight text-muted">
          <div>won {roundsWon}</div>
          <div>{FOXPIT_BUILD_VERSION}</div>
        </div>
      </div>

      {phase === "deal" && (
        <DealPhase
          slates={slates}
          kept={kept}
          keepN={keepN}
          redealsLeft={redealsLeft}
          accent={accent}
          stakes={rules.stakes}
          onToggle={toggleKeep}
          onRedeal={redeal}
          onPlay={() => startPlay()}
          onAutoPlay={() => startPlay(true)}
        />
      )}

      {phase === "play" && (
        <PlayPhase
          slates={slates}
          picks={picks}
          stakes={rules.stakes}
          seconds={rules.secondsPerQuestion}
          accent={accent}
          canLock={canLock}
          onStake={setStake}
          onPick={pick}
          onLock={lockRound}
        />
      )}

      {phase === "roundResult" && last && (
        <ResultCard
          title={last.won ? "Round won" : "Round lost"}
          accent={accent}
          you={last.you}
          boss={last.boss}
          note={`Boss reads at ${rules.bossWinPct}%`}
          cta={roundIndex + 1 >= rules.rounds ? "See the tally ›" : "Next round ›"}
          onCta={nextRound}
        />
      )}

      {phase === "roomResult" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>
            {rules.boss.toUpperCase()}
          </div>
          <div className="font-serif text-4xl" style={{ color: accent }}>
            {cleared ? "Room cleared" : "Boss holds the room"}
          </div>
          <div className="text-sm text-muted">
            You took {roundsWon} of {rules.rounds} rounds.
          </div>
          <button
            onClick={cleared ? onCleared : onExit}
            className="mt-4 rounded-xl border px-8 py-4 text-lg font-extrabold text-foreground"
            style={{ borderColor: accent, background: `${accent}22` }}
          >
            {cleared ? `Claim the ${rules.boss} key ›` : "Back to the map ›"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- deal / keep-N phase ---------------- */
function DealPhase({
  slates, kept, keepN, redealsLeft, accent, stakes, onToggle, onRedeal, onPlay, onAutoPlay,
}: {
  slates: FoxSlate[];
  kept: Set<string>;
  keepN: number;
  redealsLeft: number;
  accent: string;
  stakes: number[];
  onToggle: (id: string) => void;
  onRedeal: () => void;
  onPlay: () => void;
  onAutoPlay: () => void;
}) {
  const enough = kept.size >= keepN;

  // Decision clock: if it runs out, the hand you're holding LOCKS IN and the
  // game begins (no keep/discard penalty prompt).
  const [left, setLeft] = useState<number>(TIMERS.discardDecision);
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0) {
      if (!fired.current) { fired.current = true; onAutoPlay(); }
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onAutoPlay]);

  return (
    <div className="flex flex-1 flex-col gap-3 p-4 pb-28">
      <div className="self-center rounded-full border px-4 py-1 text-sm font-extrabold"
        style={{ borderColor: accent, color: left <= 5 ? "#E85454" : accent }}>
        {left}s
      </div>
      <div className="text-center text-sm text-muted">
        Keep at least <span className="font-extrabold" style={{ color: accent }}>{keepN}</span> — discard the rest for one redeal, then play all {slates.length}.
      </div>
      {slates.map((s) => {
        const keep = kept.has(s.id);
        const tint = slateTint(s); // app-wide category color canon
        return (
          <button
            key={s.id}
            onClick={() => onToggle(s.id)}
            className="flex items-center justify-between rounded-xl border-2 p-4 text-left transition"
            style={{ borderColor: keep ? tint.color : tint.border, background: keep ? tint.soft : "transparent" }}
          >
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: tint.color }}>
                {s.category}{s.realData ? " · real data" : ""}
              </div>
              <div className="font-serif text-lg text-foreground">{s.title}</div>
              <div className="text-xs text-muted">
                {s.questions.length} questions · worth {stakes[0]}–{stakes[stakes.length - 1]} ⛃
              </div>
            </div>
            <div className="text-xs font-extrabold" style={{ color: keep ? tint.color : "#6B7A8E" }}>
              {keep ? "KEEP ✓" : "discard"}
            </div>
          </button>
        );
      })}
      <div
        className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-border bg-background/95 p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <button
          onClick={onRedeal}
          disabled={redealsLeft <= 0 || kept.size === slates.length}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-foreground disabled:opacity-40"
        >
          Redeal discards ({redealsLeft})
        </button>
        <button
          onClick={onPlay}
          disabled={!enough}
          className="flex-1 rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          {enough ? "Play all 5 ›" : `Keep ${keepN}`}
        </button>
      </div>
    </div>
  );
}

/* ---------------- play phase ---------------- */
function PlayPhase({
  slates, picks, stakes, seconds, accent, canLock, onStake, onPick, onLock,
}: {
  slates: FoxSlate[];
  picks: Record<string, "a" | "b">;
  stakes: number[];
  seconds: number;
  accent: string;
  canLock: boolean;
  onStake: (id: string, stake: number) => void;
  onPick: (qid: string, side: "a" | "b") => void;
  onLock: () => void;
}) {
  // round timer (dead chip on expiry is handled by unanswered = wrong at settle).
  const total = seconds * slates.reduce((n, s) => n + s.questions.length, 0);
  const [left, setLeft] = useState(total);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const expired = left <= 0;

  // Clock out: whatever is in hand LOCKS IN and the round settles automatically.
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      onLock();
    }
  }, [left, onLock]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-28">
      <div className="sticky top-[64px] z-[5] self-center rounded-full border px-4 py-1 text-sm font-extrabold"
        style={{ borderColor: accent, color: expired ? "#E85454" : accent, background: "var(--surface, #0D1118)" }}>
        {expired ? "TIME" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
      </div>

      {slates.map((s, i) => {
        const tint = slateTint(s); // app-wide category color canon
        const locked = isLocked(s, picks);
        return (
        <div
          key={s.id}
          className={`rounded-xl border-2 p-4 transition ${locked ? "border-accent bg-accent/10" : ""}`}
          style={locked ? undefined : { borderColor: tint.border }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wide ${locked ? "text-accent" : ""}`}
                style={locked ? undefined : { color: tint.color }}
              >
                {s.category}
              </div>
              <div className="font-serif text-base text-foreground">Slate {i + 1} · {s.title}</div>
            </div>
            {/* locked-in: orange + the lock snaps shut and STAYS shut */}
            {locked && (
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-accent">
                <LockGlyph size={24} />
                LOCKED
              </div>
            )}
          </div>
          {/* stake tier */}
          <div className="mb-3 flex flex-wrap gap-2">
            {stakes.map((st) => (
              <button
                key={st}
                onClick={() => onStake(s.id, st)}
                className="rounded-full border px-3 py-1 text-xs font-extrabold"
                style={{ borderColor: s.stake === st ? accent : "var(--border, #1E2A38)", color: s.stake === st ? "#fff" : "#8b98a6", background: s.stake === st ? accent : "transparent" }}
              >
                {st} ⛃
              </button>
            ))}
          </div>
          {/* questions */}
          <div className="flex flex-col gap-2">
            {s.questions.map((q) => (
              <div key={q.id}>
                <div className="mb-1 text-sm text-foreground">{q.text}</div>
                <div className="flex gap-2">
                  {(["a", "b"] as const).map((side) => {
                    const sel = picks[q.id] === side;
                    return (
                      <button
                        key={side}
                        onClick={() => onPick(q.id, side)}
                        className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold"
                        style={{ borderColor: sel ? accent : "var(--border, #1E2A38)", background: sel ? `${accent}22` : "transparent", color: sel ? "#fff" : "#c3cedb" }}
                      >
                        {side === "a" ? q.optionA : q.optionB}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        );
      })}

      <div
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <button
          onClick={onLock}
          disabled={!canLock && !expired}
          className="w-full rounded-xl py-4 text-lg font-extrabold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          {canLock ? "Lock in the round ›" : expired ? "Settle (time up) ›" : "Stake + answer all 5"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- shared result card ---------------- */
function ResultCard({
  title, accent, you, boss, note, cta, onCta,
}: {
  title: string;
  accent: string;
  you: number;
  boss: number;
  note: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="font-serif text-3xl" style={{ color: accent }}>{title}</div>
      <div className="flex items-center gap-6 text-foreground">
        <div>
          <div className="text-[11px] tracking-widest text-muted">YOU</div>
          <div className="text-3xl font-extrabold">{you}</div>
        </div>
        <div className="text-muted">vs</div>
        <div>
          <div className="text-[11px] tracking-widest text-muted">BOSS</div>
          <div className="text-3xl font-extrabold">{boss}</div>
        </div>
      </div>
      <div className="text-xs text-muted">{note}</div>
      <button onClick={onCta} className="mt-4 rounded-xl border px-8 py-4 text-lg font-extrabold text-foreground" style={{ borderColor: accent, background: `${accent}22` }}>
        {cta}
      </button>
    </div>
  );
}
