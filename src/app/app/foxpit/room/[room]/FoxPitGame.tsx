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
import { ROOM_RULES, keepNFor, SLATES_PER_ROUND, REDEALS_PER_ROUND, FOXPIT_BUILD_VERSION, CATEGORY_TINT_KEY, TIMERS, CATEGORY_HEDGE, FOXPIT_CATEGORIES, cardMinFor, type FoxPitCategory } from "@/lib/foxpit/rules";
import { dealFoxSlates, categoriesFor, roundScore, bossRoundScore, slateWon, type FoxSlate } from "@/lib/foxpit/slates";

/** Design-system semantic colors (win green / loss red), referenced by name. */
const COLOR_WIN = "#22C55E";
const COLOR_LOSS = "#E85454";

/** A slate is LOCKED once it's staked and every question is answered. */
function isLocked(s: FoxSlate, picks: Record<string, "a" | "b">): boolean {
  return s.stake != null && s.questions.every((q) => picks[q.id] != null);
}
/** The app-wide category color canon for a Fox Pit slate. */
function slateTint(s: FoxSlate) {
  return categoryTint(CATEGORY_TINT_KEY[s.category]);
}

/**
 * Round beats, in order. CATEGORY and TIP run BEFORE any card exists — the deal is
 * no longer done at mount, it happens on entry to `dealing` once both beats resolve.
 *   category → tip → dealing → deal (keep-N + one redeal) → play → reveal → announce
 */
type Phase =
  | "category"
  | "tip"
  | "dealing"
  | "deal"
  | "play"
  | "reveal"
  | "announce"
  | "roomResult";

/** Coin-drop audio for the announcement. Never silent-fails — logs instead. */
function playCoinDrop(won: boolean): void {
  try {
    const a = new Audio(won ? "/sounds/2-win-big-bag.mp3" : "/sounds/1-loss-rake.mp3");
    a.volume = 0.75;
    void a.play().catch((err) => console.error("[foxpit] coin-drop audio blocked:", err));
  } catch (err) {
    console.error("[foxpit] coin-drop audio failed:", err);
  }
}

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

  const [phase, setPhase] = useState<Phase>("category");
  const [roundIndex, setRoundIndex] = useState(0);
  // NOTE: no deal at mount. Cards only exist once `dealRound()` runs, which happens
  // after the category-select (and tip) beats have resolved.
  const [slates, setSlates] = useState<FoxSlate[]>([]);
  /** Categories the player hedged into this round (empty until the beat resolves). */
  const [pickedCats, setPickedCats] = useState<FoxPitCategory[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [redealsLeft, setRedealsLeft] = useState(REDEALS_PER_ROUND);
  const [picks, setPicks] = useState<Record<string, "a" | "b">>({});
  const [roundsWon, setRoundsWon] = useState(0);
  const [last, setLast] = useState<{ you: number; boss: number; won: boolean } | null>(null);

  const keepN = keepNFor(roomKey, roundIndex);
  /** Forced-minimum cards to play vs this room's boss (item 2). Owl/Wolf = 1, Raven/Fox = 5. */
  const cardMin = cardMinFor(rules.boss);
  /** A card is "played" once it's staked AND fully answered. */
  const playedCount = slates.filter((s) => isLocked(s, picks)).length;

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
    const fresh = dealFoxSlates(roomKey, pickedCats);
    let fi = 0;
    setSlates((prev) => prev.map((s) => (kept.has(s.id) ? s : fresh[fi++]!)));
    setRedealsLeft((r) => r - 1);
  };

  /** Go to the table. No keep-N gate — the player picks how many cards to PLAY at the table
   *  (item 1), and redeal works at any keep count (item 3). `force` = the decision clock ran out. */
  const startPlay = (_force = false) => {
    setPhase("play");
  };

  /* ------- PLAY ------- */
  const setStake = (slateId: string, stake: number) =>
    setSlates((prev) => prev.map((s) => (s.id === slateId ? { ...s, stake } : s)));
  const pick = (qid: string, side: "a" | "b") => setPicks((p) => ({ ...p, [qid]: side }));

  // Lock-in unlocks once the player has fully played at least the floor (1 for Owl/Wolf, 5 for
  // Raven/Fox) — NOT all 5 (items 1, 4). Never auto-fill; the reason shows on screen below the floor.
  const canLock = playedCount >= cardMin;

  const lockRound = () => {
    // Manual early-lock below the floor is blocked by the disabled button + on-screen reason;
    // the round timer still force-settles with whatever is in hand.
    const played = slates.filter((s) => isLocked(s, picks)).length;
    const you = roundScore(slates, picks);
    const boss = bossRoundScore(roomKey, played); // boss plays EXACTLY as many as the player (item 2)
    const won = you >= boss;
    setLast({ you, boss, won });
    if (won) setRoundsWon((w) => w + 1);
    setPhase("reveal"); // cards reveal first, then the Locksmith calls it
  };

  /** The ONLY place a round's cards are created. Runs on entry to `dealing`. */
  const dealRound = (cats: FoxPitCategory[]) => {
    setSlates(dealFoxSlates(roomKey, cats));
    setPhase("dealing");
  };

  /** Beat 1 done → beat 2 (tip). Fox has no hedge, so it resolves straight through. */
  const confirmCategories = (cats: FoxPitCategory[]) => {
    setPickedCats(cats);
    setPhase("tip");
  };

  const nextRound = () => {
    if (roundIndex + 1 >= rules.rounds) {
      setPhase("roomResult");
      return;
    }
    setRoundIndex((r) => r + 1);
    setSlates([]);
    setPickedCats([]);
    setKept(new Set());
    setRedealsLeft(REDEALS_PER_ROUND);
    setPicks({});
    setLast(null);
    setPhase("category");
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

      {phase === "category" && (
        <CategorySelectPhase
          roomKey={roomKey}
          accent={accent}
          onConfirm={confirmCategories}
        />
      )}

      {/* Beat 2 — the Locksmith's tip. The lockpick store isn't built yet, so this
          resolves straight through to the deal; it exists as its own beat so the
          spend lands here and not inside the deal. */}
      {phase === "tip" && (
        <TipPhase accent={accent} onDone={() => dealRound(pickedCats)} />
      )}

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
          cardMin={cardMin}
          playedCount={playedCount}
          bossName={rules.boss}
          onStake={setStake}
          onPick={pick}
          onLock={lockRound}
        />
      )}

      {phase === "reveal" && last && (
        <RevealPhase slates={slates} picks={picks} accent={accent} onDone={() => setPhase("announce")} />
      )}

      {phase === "announce" && last && (
        <AnnouncePhase
          roomKey={roomKey}
          accent={accent}
          won={last.won}
          you={last.you}
          boss={last.boss}
          note={`${rules.boss} reads at ${rules.bossWinPct}%`}
          cta={roundIndex + 1 >= rules.rounds ? "See the tally ›" : "Next round ›"}
          onCta={nextRound}
          onQuit={onExit}
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
/* ---------------- BEAT 1 — category select ----------------
 * The hedge decays with difficulty (CATEGORY_HEDGE): Owl picks 5, Wolf 3, Raven 2,
 * Boss Fox gets no hedge at all (everything is dealt). This is SEPARATE from keep-N,
 * which is the mulligan floor applied after the cards land. */
function CategorySelectPhase({
  roomKey, accent, onConfirm,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  onConfirm: (cats: FoxPitCategory[]) => void;
}) {
  const pool = categoriesFor(roomKey);
  const hedge = CATEGORY_HEDGE[roomKey];
  const noHedge = hedge.dealt === "all";
  const pick = Math.min(hedge.pick, pool.length);
  const [chosen, setChosen] = useState<FoxPitCategory[]>([]);

  // Boss Fox: no choice to make — everything is dealt, so don't stall the round.
  useEffect(() => {
    if (noHedge) onConfirm(pool);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noHedge]);
  if (noHedge) return null;

  const toggle = (c: FoxPitCategory) =>
    setChosen((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : prev.length >= pick ? prev : [...prev, c],
    );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
      <div className="text-center">
        <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>
          CATEGORY SELECT
        </div>
        <div className="mt-1 font-serif text-2xl text-foreground">Pick your ground</div>
        <div className="mt-1 text-[13px] text-muted">
          Choose {pick} of {pool.length} — the round deals from these only.
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-wrap justify-center gap-2">
        {pool.map((c) => {
          const on = chosen.includes(c);
          const tint = categoryTint(CATEGORY_TINT_KEY[c]);
          return (
            <button
              key={c}
              onClick={() => toggle(c)}
              className="rounded-xl border px-4 py-3 text-sm font-bold capitalize transition"
              style={{
                borderColor: on ? tint.color : "var(--border)",
                background: on ? tint.soft : "transparent",
                color: on ? tint.color : "var(--muted)",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      <button
        disabled={chosen.length < pick}
        onClick={() => onConfirm(chosen)}
        className="w-full max-w-sm rounded-xl border px-6 py-4 text-base font-extrabold disabled:opacity-40"
        style={{ borderColor: accent, background: `${accent}22`, color: "var(--foreground)" }}
      >
        {chosen.length < pick ? `Pick ${pick - chosen.length} more` : "Lock the hedge ›"}
      </button>
    </div>
  );
}

/* ---------------- BEAT 2 — the Locksmith's tip ----------------
 * Placeholder beat: the lockpick store + inventory are not built yet, so there is
 * nothing to spend. It advances immediately rather than faking a purchase. */
function TipPhase({ accent, onDone }: { accent: string; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = window.setTimeout(() => done.current(), 0);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>
        …
      </div>
    </div>
  );
}

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
  slates, kept, redealsLeft, accent, stakes, onToggle, onRedeal, onPlay, onAutoPlay,
}: {
  slates: FoxSlate[];
  kept: Set<string>;
  redealsLeft: number;
  accent: string;
  stakes: number[];
  onToggle: (id: string) => void;
  onRedeal: () => void;
  onPlay: () => void;
  onAutoPlay: () => void;
}) {
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
        Keep the cards you like — discard the rest for one redeal, then play as many as you want at the table.
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
          className="flex-1 rounded-xl py-3 text-sm font-extrabold text-white"
          style={{ background: accent }}
        >
          To the table ›
        </button>
      </div>
    </div>
  );
}

/* ---------------- play phase ---------------- */
function PlayPhase({
  slates, picks, stakes, seconds, accent, canLock, cardMin, playedCount, bossName, onStake, onPick, onLock,
}: {
  slates: FoxSlate[];
  picks: Record<string, "a" | "b">;
  stakes: number[];
  seconds: number;
  accent: string;
  canLock: boolean;
  cardMin: number;
  playedCount: number;
  bossName: string;
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
        {/* how many the player is playing + the floor for this boss */}
        <div className="mb-2 text-center text-[12px] font-semibold text-muted">
          Playing <span className="font-extrabold" style={{ color: accent }}>{playedCount}</span> of {slates.length}
          {cardMin > 1 ? ` · ${bossName} requires at least ${cardMin}` : " · your call, 1–" + slates.length}
        </div>
        {/* item 2: block below the floor and SAY WHY (never auto-fill) */}
        {!canLock && !expired && (
          <div className="mb-2 text-center text-[12px] font-bold" style={{ color: COLOR_LOSS }}>
            Stake + answer {cardMin - playedCount} more card{cardMin - playedCount > 1 ? "s" : ""} to lock in
          </div>
        )}
        <button
          onClick={onLock}
          disabled={!canLock && !expired}
          className="w-full rounded-xl py-4 text-lg font-extrabold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          {canLock
            ? `Lock in ${playedCount} card${playedCount > 1 ? "s" : ""} ›`
            : expired
              ? "Settle (time up) ›"
              : `Play ${Math.max(1, cardMin - playedCount)} more`}
        </button>
      </div>
    </div>
  );
}

/* ---------------- reveal: outcomes overlaid on the card fronts ---------------- */
function RevealPhase({
  slates, picks, accent, onDone,
}: {
  slates: FoxSlate[];
  picks: Record<string, "a" | "b">;
  accent: string;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 pb-28">
      <div className="text-center text-sm font-extrabold tracking-widest" style={{ color: accent }}>
        THE CARDS COME OVER
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {slates.map((s) => {
          const tint = slateTint(s);
          const won = slateWon(s, picks);
          return (
            <div key={s.id} className="relative w-[31%] min-w-[100px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARD_FRONT} alt="" className="block h-auto w-full" />
              <div className="absolute inset-0 flex flex-col px-2 pb-2 pt-[28%] text-left">
                <div className="text-[8px] font-bold uppercase" style={{ color: tint.color }}>{s.category}</div>
                <div className="font-serif text-[10px] leading-tight text-foreground">{s.title}</div>
                <div className="mt-1 flex flex-col gap-[1px]">
                  {s.questions.map((q) => {
                    const hit = picks[q.id] === q.outcome;
                    return (
                      <div key={q.id} className="truncate text-[8px] font-bold" style={{ color: hit ? COLOR_WIN : COLOR_LOSS }}>
                        {hit ? "✓" : "✗"} {q.outcome === "a" ? q.optionA : q.optionB}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto text-[9px] font-extrabold" style={{ color: won ? COLOR_WIN : COLOR_LOSS }}>
                  {won ? `WON ${s.stake ?? 0} ⛃` : "LOST"}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-[10px] border-2" style={{ borderColor: won ? COLOR_WIN : COLOR_LOSS }} />
            </div>
          );
        })}
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        <button onClick={onDone} className="w-full rounded-xl py-4 text-lg font-extrabold text-white" style={{ background: accent }}>
          Hear the call ›
        </button>
      </div>
    </div>
  );
}

/* ---------------- announce: the Locksmith calls it at the table + coin drop ---------------- */
function AnnouncePhase({
  roomKey, accent, won, you, boss, note, cta, onCta, onQuit,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  won: boolean;
  you: number;
  boss: number;
  note: string;
  cta: string;
  onCta: () => void;
  onQuit: () => void;
}) {
  useEffect(() => { playCoinDrop(won); }, [won]);
  // Her raised arm points at the WINNING seat: right = you, left = the boss.
  const announce = won
    ? "/foxpit/locksmith/locksmith_announce_right.png"
    : "/foxpit/locksmith/locksmith_announce_left.png";

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[roomKey]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 55% at 50% 50%, transparent, rgba(3,4,7,.8))" }} />
      {/* back at the same table */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOCKSMITH_TABLE} alt="" className="relative z-[1] max-h-[58%] w-auto max-w-[92%] object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={announce} alt="The Locksmith announces the winner" className="absolute z-[3] max-h-[40%] w-auto" style={{ top: "4%" }} />

      {/* coin drop onto the table */}
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className="absolute z-[2] rounded-full"
          style={{
            left: `${20 + i * 7.5}%`,
            top: `${54 + (i % 3) * 5}%`,
            width: 18,
            height: 18,
            background: "radial-gradient(circle at 35% 30%, #ffe9a8, #d9a521 60%, #8a6410)",
            boxShadow: "0 2px 6px rgba(0,0,0,.6)",
            animation: `foxpitCoinDrop .9s cubic-bezier(.3,1.2,.4,1) ${i * 0.07}s both`,
          }}
        />
      ))}

      <div
        className="absolute bottom-0 left-0 right-0 z-[4] flex flex-col items-center gap-1 p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
      >
        <div className="font-serif text-3xl" style={{ color: won ? COLOR_WIN : accent }}>
          {won ? "You take the round" : "The boss takes it"}
        </div>
        <div className="text-sm font-bold text-foreground">YOU {you} · BOSS {boss}</div>
        <div className="text-xs text-muted">{note}</div>
        {/* Quit + advance sit at the bottom, clear of her raised arm/name up top (item 6). */}
        <div className="mt-3 flex w-full max-w-sm gap-2">
          <button
            onClick={onQuit}
            className="flex-1 rounded-xl border border-border py-4 text-base font-extrabold text-muted"
          >
            Quit game
          </button>
          <button onClick={onCta} className="flex-[1.4] rounded-xl py-4 text-lg font-extrabold text-white" style={{ background: accent }}>
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
