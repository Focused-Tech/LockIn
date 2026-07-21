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

type Phase = "dealing" | "deal" | "play" | "roundResult" | "roomResult";

/** Per-room floor tile — the base the dealer table sits on. */
const FLOOR_IMG: Record<FoxPitRoomKey, string> = {
  dojo: "/foxpit/floors/floor_dojo.png",
  coliseum: "/foxpit/floors/floor_coliseum.png",
  hightable: "/foxpit/floors/floor_ravensnest.png",
  suite: "/foxpit/floors/floor_foxden.png",
};
/** Top-down dealer table (Locksmith seated, chips + tray + deck baked in). */
const LOCKSMITH_TABLE = "/foxpit/tables/locksmith_player_table.png";
/** The LockIn card face every slate is drawn on. */
const CARD_FRONT = "/foxpit/cards/card_front_single.png";

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

  const [phase, setPhase] = useState<Phase>("dealing");
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
    setPhase("dealing");
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

      {phase === "dealing" && (
        <DealingTable
          roomKey={roomKey}
          accent={accent}
          /* lead alternates each round: round 1 boss deals first, round 2 player. */
          bossFirst={roundIndex % 2 === 0}
          onDone={() => setPhase("deal")}
        />
      )}

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

/* ---------------- dealing: cards dealt out on the Locksmith table ---------------- */
function DealingTable({
  roomKey, accent, bossFirst, onDone,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  bossFirst: boolean;
  onDone: () => void;
}) {
  const TOTAL = SLATES_PER_ROUND * 2; // five to the boss, five to you
  const [dealt, setDealt] = useState(0);

  useEffect(() => {
    if (dealt >= TOTAL) {
      const t = setTimeout(onDone, 850);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDealt((d) => d + 1), 210);
    return () => clearTimeout(t);
  }, [dealt, TOTAL, onDone]);

  // spades-style: the lead side gets the first card, then strictly alternating.
  const cards = Array.from({ length: TOTAL }, (_, i) => {
    const toBoss = bossFirst ? i % 2 === 0 : i % 2 === 1;
    const slot = Math.floor(i / 2); // 0..4 across each fan
    // Both fans land ON the green felt (which runs roughly 46%–77% of the frame):
    // the boss's across the far side clear of the dealer, yours nearest the viewer.
    return { i, toBoss, x: 26 + slot * 12, y: toBoss ? 55 : 70 };
  });

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[roomKey]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 55% at 50% 50%, transparent, rgba(3,4,7,.78))" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOCKSMITH_TABLE} alt="The Locksmith deals" className="relative z-[1] max-h-[78%] w-auto max-w-[96%] object-contain" />

      {cards.map((c) => {
        const out = c.i < dealt;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.i}
            src={CARD_FRONT}
            alt=""
            className="absolute z-[2] w-[11%] max-w-[62px]"
            style={{
              left: out ? `${c.x}%` : "50%",
              top: out ? `${c.y}%` : "33%",
              transform: `translate(-50%,-50%) rotate(${out ? (c.toBoss ? -6 : 6) : 0}deg) scale(${out ? 1 : 0.65})`,
              opacity: out ? 1 : 0,
              transition: "left .34s cubic-bezier(.2,.8,.2,1), top .34s cubic-bezier(.2,.8,.2,1), transform .34s, opacity .16s",
              filter: "drop-shadow(0 6px 12px rgba(0,0,0,.7))",
            }}
          />
        );
      })}

      <div
        className="absolute left-0 right-0 text-center text-xs font-extrabold tracking-widest"
        style={{ color: accent, bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
      >
        {dealt >= TOTAL ? "PICK UP YOUR HAND" : `DEALING · ${bossFirst ? "BOSS" : "YOU"} FIRST`}
      </div>
    </div>
  );
}

/* ---------------- a slate drawn on the LockIn card face ---------------- */
function SlateCardFace({
  slate, keep, tint, stakes, onClick,
}: {
  slate: FoxSlate;
  keep: boolean;
  tint: { color: string; soft: string; border: string };
  stakes: number[];
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="relative w-[31%] min-w-[100px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CARD_FRONT} alt="" className="block h-auto w-full" />
      {/* content sits under the LockIn mark printed on the face */}
      <div className="absolute inset-0 flex flex-col px-2 pb-2 pt-[30%] text-left">
        <div className="text-[8px] font-bold uppercase leading-tight" style={{ color: tint.color }}>
          {slate.category}
        </div>
        <div className="font-serif text-[11px] leading-tight text-foreground">{slate.title}</div>
        <div className="mt-auto text-[8px] text-muted">
          {slate.questions.length}Q · {stakes[0]}–{stakes[stakes.length - 1]} ⛃
        </div>
      </div>
      {/* category outline; brightens + fills when kept */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[10px] border-2"
        style={{ borderColor: keep ? tint.color : tint.border, background: keep ? tint.soft : "transparent" }}
      />
      {keep && (
        <div className="absolute right-1 top-1 rounded px-1 text-[8px] font-extrabold" style={{ color: tint.color, background: "rgba(3,4,7,.7)" }}>
          KEEP ✓
        </div>
      )}
    </button>
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
      {/* your hand — each slate drawn on the LockIn card face */}
      <div className="flex flex-wrap justify-center gap-2">
        {slates.map((s) => (
          <SlateCardFace
            key={s.id}
            slate={s}
            keep={kept.has(s.id)}
            tint={slateTint(s)}
            stakes={stakes}
            onClick={() => onToggle(s.id)}
          />
        ))}
      </div>
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
