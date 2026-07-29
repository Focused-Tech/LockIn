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
import { roomByKey, KEY_ASSET, type FoxPitRoomKey } from "@/lib/foxpit";
import { ROOM_RULES, keepNFor, SLATES_PER_ROUND, REDEALS_PER_ROUND, CATEGORY_TINT_KEY, TIMERS, FOXPIT_CATEGORIES, cardMinFor, unlockedTierCount, type FoxPitCategory } from "@/lib/foxpit/rules";
import { settleRound, type FoxSlate, type BossStakeMode, type RoundSettlement, type CardLedgerLine } from "@/lib/foxpit/slates";
import { SlateCard, type SlateLeg } from "@/components/slate/SlateCard";
import { RoundChrome } from "./RoundChrome";
import { applyFoxPitCoins, dealFoxRound } from "../../actions";

/** Resolve the player's shared interest categories (users/{uid}.categories[]) to the Fox Pit set.
 *  Case-insensitive intersection; falls back to all Fox Pit categories if none match. */
function resolvePlayerCats(userCategories: string[]): FoxPitCategory[] {
  const wanted = new Set(userCategories.map((c) => c.toLowerCase()));
  const matched = FOXPIT_CATEGORIES.filter((c) => wanted.has(c));
  return matched.length ? matched : [...FOXPIT_CATEGORIES];
}

/** Design-system semantic colors (win green / loss red), referenced by name. */
const COLOR_WIN = "#22C55E";
const COLOR_LOSS = "#E85454";

/** A slate is LOCKED once it's staked and every question the player CHOSE TO PLAY is answered. */
function isLocked(s: FoxSlate, picks: Record<string, number>): boolean {
  return s.stake != null && s.questions.slice(0, s.playCount).every((q) => picks[q.id] != null);
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
  | "howto"
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
/** Top-down dealer table (Locksmith seated, chips + tray + deck baked in) — the DEALING phase. */
const LOCKSMITH_TABLE = "/foxpit/tables/locksmith_player_table.png";
/** WINNER-announcement tables — Locksmith + table baked in ONE sprite, raised arm = winner's side.
 *  Every Fox Pit opponent is a boss, so the announcement uses the BOSS table. */
const WINNER_TABLE_BOSS_RIGHT = "/foxpit/tables/locksmith_winners_boss_right.png"; // player wins (right arm)
const WINNER_TABLE_BOSS_LEFT = "/foxpit/tables/locksmith_winners_boss_left.png"; // boss wins (left arm)
/** The LockIn card face every slate is drawn on. */
const CARD_FRONT = "/foxpit/cards/card_front_single.png";

/** Dethroned-boss cutouts (transparent) for the room-cleared key drop — each boss knocked off
 *  their throne, dropping/handing over their key. Public/foxpit/defeated. */
const DEFEATED_BOSS: Record<FoxPitRoomKey, string> = {
  dojo: "/foxpit/defeated/owl_defeated.png",
  coliseum: "/foxpit/defeated/alphawolf_defeated.png",
  hightable: "/foxpit/defeated/raven_walkaway_dropping.png",
  suite: "/foxpit/defeated/bossfox_key_handoff.png",
};
/** Raven flings a feather as she walks away (hightable only). */
const RAVEN_FEATHER = "/foxpit/defeated/raven_drop_feather.png";

export function FoxPitGame({
  roomKey,
  userCategories,
  username = "Member",
  coinBalance = 0,
  opponent = null,
  onExit,
  onQuitGame,
  onCleared,
}: {
  roomKey: FoxPitRoomKey;
  userCategories: string[];
  /** the player's username — names the winner at settlement (4.2). */
  username?: string;
  /** §3.3 — coin balance at entry; the chrome shows it and visibly bumps it when a round is won. */
  coinBalance?: number;
  /** The seated underling for this table (null = the room boss's own table). Drives the
   *  displayed name + the AI win rate; null falls back to the room boss. `art` (when present) is the
   *  underling's cutout, shown on the underling-beaten screen (§3.2). */
  opponent?: { name: string; winPct: number; art?: string } | null;
  /** Quit the ROUND — back to the room / table picker. */
  onExit: () => void;
  /** Quit the GAME — all the way out to the Fox Pit landing (leave, not just the board). */
  onQuitGame: () => void;
  onCleared: () => void;
}) {
  const rules = ROOM_RULES[roomKey];
  const room = roomByKey(roomKey);
  const accent = room.accent;
  // Who you're actually facing at THIS table — an underling (Coliseum/High Table floor
  // tables) or the room boss (his own table / solo-boss rooms).
  const oppName = opponent?.name ?? rules.boss;
  const oppWinPct = opponent?.winPct ?? rules.bossWinPct;
  // §3.2 — you're facing the FLOOR BOSS only when there's no seated underling (his own table /
  // solo-boss rooms Owl + Fox). The dethrone + key drop fire ONLY here; beating an underling gets
  // its own screen and never claims the boss's key.
  const isBoss = opponent == null;

  // The Dojo opens on the HOW-TO-PLAY screen (item 5) — its own beat BEFORE category select —
  // unless the player has already dismissed/skipped it (remembered). Every other room starts at
  // category select. Lazy init so there's no flash of the wrong screen.
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window !== "undefined") {
      try {
        if (roomKey === "dojo" && !localStorage.getItem("foxpit.howto.v1")) return "howto";
      } catch (err) {
        console.error("[foxpit] how-to flag read failed:", err);
      }
    }
    return "tip"; // A5: categories come from the LOCKER now — no in-game category-select beat
  });
  const [roundIndex, setRoundIndex] = useState(0);
  // NOTE: no deal at mount. Cards only exist once `dealRound()` runs, which happens
  // after the category-select (and tip) beats have resolved.
  const [slates, setSlates] = useState<FoxSlate[]>([]);
  /** Categories for the session — chosen in the LOCKER (A5), resolved to the Fox Pit set. Used for
   *  every round; no in-game re-pick. */
  const [pickedCats] = useState<FoxPitCategory[]>(() => resolvePlayerCats(userCategories));
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [redealsLeft, setRedealsLeft] = useState(REDEALS_PER_ROUND);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [dealPending, setDealPending] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [roundsWon, setRoundsWon] = useState(0);
  // §3.3 — live coin balance shown in the chrome. Bumps optimistically the moment a round settles,
  // then reconciles to the server's authoritative newBalance.
  const [coins, setCoins] = useState(coinBalance);
  // Boss stake mode chosen per round (item 4). Persisted WITH the round result (in `last`), not
  // held only as a transient toggle — it affects scoring + the tally.
  const [bossMode, setBossMode] = useState<BossStakeMode>("match");
  const [last, setLast] = useState<(RoundSettlement & { won: boolean; bossMode: BossStakeMode }) | null>(null);
  // DEV PREVIEW (temporary): jump straight to the dethroned-boss key-drop without playing a full
  // room. Remove before launch along with the 🔑 button below.
  const [keyPreview, setKeyPreview] = useState(false);

  // Skip/Start on the how-to screen: remember the dismissal and advance to the deal (categories
  // are already chosen in the locker).
  const dismissHowTo = () => {
    try {
      localStorage.setItem("foxpit.howto.v1", "1");
    } catch (err) {
      console.error("[foxpit] how-to flag write failed:", err);
    }
    setPhase("tip");
  };

  const keepN = keepNFor(roomKey, roundIndex);
  /** Forced-minimum cards to play vs this room's boss (item 2). Owl/Wolf = 1, Raven/Fox = 5. */
  const cardMin = cardMinFor(oppName);
  /** A card is "played" once it's staked AND fully answered. */
  const playedCount = slates.filter((s) => isLocked(s, picks)).length;
  /** Breadth (item 3): choosing N categories opens the lowest N stake tiers of the room ladder. */
  const unlockedStakes = rules.stakes.slice(0, unlockedTierCount(pickedCats.length, rules.stakes.length));

  /* ------- DEAL / keep-N ------- */
  const toggleKeep = (id: string) => {
    setKept((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const redeal = async () => {
    if (redealsLeft <= 0 || dealPending) return;
    // Fetch FRESH cards for exactly the non-kept slots from the never-repeat pool (marks them seen).
    const discardCount = slates.filter((s) => !kept.has(s.id)).length;
    if (discardCount === 0) return;
    setDealPending(true);
    setDealError(null);
    const res = await dealFoxRound(roomKey, pickedCats, discardCount);
    setDealPending(false);
    if (!res.ok || !res.slates) {
      setDealError(res.error ?? "Couldn't redeal. Try again.");
      return;
    }
    let fi = 0;
    setSlates((prev) => prev.map((s) => (kept.has(s.id) ? s : (res.slates![fi++] ?? s))));
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
  // (5b) per-card question count — the player dials how many of the dealt questions to play (1..max).
  // Changing it clears that card's stake (the ceiling moved) so they re-confirm the bid.
  const setPlayCount = (slateId: string, n: number) =>
    setSlates((prev) => prev.map((s) => (s.id === slateId ? { ...s, playCount: Math.max(1, Math.min(n, s.questions.length)), stake: null } : s)));
  const pick = (qid: string, optionIndex: number) => {
    setPicks((p) => ({ ...p, [qid]: optionIndex }));
    // (e) changing/adding an answer RE-OPENS that card's stake — never lock a bid the player can no
    // longer justify. Only the slate that owns this question is affected.
    setSlates((prev) => prev.map((s) => (s.stake != null && s.questions.some((q) => q.id === qid) ? { ...s, stake: null } : s)));
    // (c) once this answer COMPLETES the card, bring its now-enabled stake row into view — no scroll-up.
    const slate = slates.find((s) => s.questions.some((q) => q.id === qid));
    if (slate && slate.questions.every((q) => (q.id === qid ? true : picks[q.id] != null))) {
      requestAnimationFrame(() => {
        try {
          document.getElementById(`stake-${slate.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch (err) {
          console.error("[foxpit] stake scrollIntoView failed", err);
        }
      });
    }
  };

  // Lock-in unlocks once the player has fully played at least the floor (1 for Owl/Wolf, 5 for
  // Raven/Fox) — NOT all 5 (items 1, 4). Never auto-fill; the reason shows on screen below the floor.
  const canLock = playedCount >= cardMin;

  const lockRound = () => {
    // Manual early-lock below the floor is blocked by the disabled button + on-screen reason;
    // the round timer still force-settles with whatever is in hand.
    const played = slates.filter((s) => isLocked(s, picks)); // boss plays EXACTLY these cards (item 2)
    const topStake = rules.stakes[rules.stakes.length - 1] ?? 0;
    // PER-CARD HEAD-TO-HEAD (Frank's model): each card settles on its own — player-right/boss-wrong
    // takes the boss's stake, boss-right/player-wrong loses the player's stake, both/neither PUSH.
    // Boss stake per card = MATCH (player's tier) or TOP (flat top tier). No multipliers.
    const settlement = settleRound(played, picks, bossMode, topStake, () => Math.random() * 100 < oppWinPct);
    const won = settlement.playerCards >= settlement.bossCards; // took at least as many H2H cards
    setLast({ ...settlement, won, bossMode });
    if (won) setRoundsWon((w) => w + 1);
    // Persist the round's NET COIN result to the wallet (coins only, zero rake). Round net = Σ per-card
    // outcomes. Until this, the tower never touched users/{uid}.coinBalance.
    if (settlement.net !== 0) {
      // §3.3 — bump the chrome balance NOW (visible + legible on a win), then reconcile to the
      // server's authoritative newBalance so the number never drifts.
      setCoins((c) => c + settlement.net);
      applyFoxPitCoins(settlement.net)
        .then((r) => { if (r?.ok && typeof r.newBalance === "number") setCoins(r.newBalance); })
        .catch((e) => console.error("[foxpit] coin persist failed", e));
    }
    setPhase("reveal"); // cards reveal first, then the Locksmith calls it
  };

  /** The ONLY place a round's cards are created. Runs on entry to `dealing`. `count` = how many cards
   *  the player chose to deal on the deal screen (defect 4), within the floor's legal range. */
  const dealRound = async (cats: FoxPitCategory[], count: number = SLATES_PER_ROUND) => {
    const n = Math.max(1, Math.min(count, SLATES_PER_ROUND));
    setDealError(null);
    setDealPending(true);
    // Fetch the round's cards from the never-repeat MC pool (server action), THEN animate the deal.
    const res = await dealFoxRound(roomKey, cats, n);
    setDealPending(false);
    if (!res.ok || !res.slates) {
      setDealError(res.error ?? "Couldn't deal this round.");
      return;
    }
    setSlates(res.slates);
    setPhase("dealing");
  };

  const nextRound = () => {
    if (roundIndex + 1 >= rules.rounds) {
      setPhase("roomResult");
      return;
    }
    setRoundIndex((r) => r + 1);
    setSlates([]);
    // pickedCats stays — it's the locker's session choice, not a per-round pick.
    setKept(new Set());
    setRedealsLeft(REDEALS_PER_ROUND);
    setPicks({});
    setLast(null);
    setBossMode("match");
    setPhase("tip"); // straight to the deal (no in-game category beat)
  };

  const cleared = roundsWon > rules.rounds / 2;

  // ROUND CLOCK (defect 3, full) — lifted here so it pins in the sticky HEADER on every round screen
  // (deal / keep-redeal / play), never scrolled away or ghosted. Budget = seconds/question × the
  // round's total questions; it counts down during play and force-settles the round once on expiry.
  // On the pre-play screens it shows the budget (static) so the player sees the clock they'll race.
  const roundTotal = rules.secondsPerQuestion * slates.reduce((n, s) => n + s.questions.length, 0);
  const [timeLeft, setTimeLeft] = useState(0);
  const clockFired = useRef(false);
  useEffect(() => {
    if (phase === "play") { setTimeLeft(roundTotal); clockFired.current = false; }
    // roundTotal is fixed once the round is dealt; only the phase transition should (re)start the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => {
    if (phase !== "play" || timeLeft <= 0) return;
    const t = window.setTimeout(() => setTimeLeft((l) => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, timeLeft]);
  useEffect(() => {
    if (phase === "play" && roundTotal > 0 && timeLeft <= 0 && !clockFired.current) {
      clockFired.current = true;
      lockRound();
    }
  }, [phase, timeLeft, roundTotal]);
  const clockPlaying = phase === "play";
  const clockShow = clockPlaying ? timeLeft : roundTotal;
  const clockAlert = clockPlaying && timeLeft <= 15;
  const clockVisible = roundTotal > 0 && (phase === "play" || phase === "deal" || phase === "dealing");
  const clockExpired = phase === "play" && roundTotal > 0 && timeLeft <= 0;

  return (
    <div
      className="fixed inset-0 z-[67] flex flex-col overflow-y-auto bg-background text-foreground"
      // scroll-into-view must never park content under the fixed footer — reserve more than the tallest
      // footer (lock button + 2 note rows) plus the nav-bar inset. The exact per-view padding is measured.
      style={{ scrollPaddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 200px)" }}
    >
      {/* DEV PREVIEW keydrop now lives in the RoundChrome header (beside the timer), not floating. */}
      {keyPreview && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-background">
          <KeyDropPhase
            roomKey={roomKey}
            accent={accent}
            bossName={oppName}
            roundsWon={Math.ceil(rules.rounds / 2 + 0.5)}
            totalRounds={rules.rounds}
            onDone={() => setKeyPreview(false)}
          />
        </div>
      )}
      {/* 3.3b — ROUND CHROME (keydrop lives here, beside the timer — never on a card). */}
      <RoundChrome
        oppName={oppName}
        roundIndex={roundIndex}
        rounds={rules.rounds}
        keepN={keepN}
        slatesPerRound={SLATES_PER_ROUND}
        accent={accent}
        clockVisible={clockVisible}
        clockLabel={clockShow < 0 ? "0:00" : `${Math.floor(clockShow / 60)}:${String(clockShow % 60).padStart(2, "0")}`}
        clockAlert={clockAlert}
        roundsWon={roundsWon}
        coins={coins}
        onQuit={onQuitGame}
        onKeydrop={() => setKeyPreview(true)}
      />

      {/* Deal from the never-repeat pool is a server round-trip — cover it, and surface a real error
          (empty pool / network) instead of a dead screen. */}
      {dealPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(6,8,12,.72)" }}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border" style={{ borderTopColor: accent }} />
            <div className="text-sm font-semibold text-muted">Dealing…</div>
          </div>
        </div>
      )}
      {dealError && (
        <div
          className="fixed inset-x-0 z-50 mx-auto max-w-sm rounded-xl border border-[#E85454] bg-[#E85454]/10 px-4 py-3 text-center"
          style={{ top: "calc(env(safe-area-inset-top,0px) + 64px)" }}
        >
          <div className="text-sm font-semibold text-[#E85454]">{dealError}</div>
          <button onClick={() => setDealError(null)} className="mt-2 rounded-lg border border-[#E85454] px-3 py-1 text-xs font-bold text-[#E85454]">
            Dismiss
          </button>
        </div>
      )}

      {phase === "howto" && <HowToPlay accent={accent} onDismiss={dismissHowTo} />}

      {/* Pre-round beat — pick which fight (MATCH / TOP). Categories were chosen in the locker (A5). */}
      {phase === "tip" && (
        <BossModePhase
          accent={accent}
          stakes={rules.stakes}
          bossName={oppName}
          bossMode={bossMode}
          onBossMode={setBossMode}
          cardMin={cardMin}
          onDone={(n) => dealRound(pickedCats, n)}
        />
      )}

      {phase === "dealing" && (
        <DealingTable
          roomKey={roomKey}
          accent={accent}
          count={slates.length}
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
          unlockedStakes={unlockedStakes}
          categoryCount={pickedCats.length}
          expired={clockExpired}
          accent={accent}
          canLock={canLock}
          cardMin={cardMin}
          playedCount={playedCount}
          bossName={oppName}
          onStake={setStake}
          onPlayCount={setPlayCount}
          onPick={pick}
          onLock={lockRound}
        />
      )}

      {phase === "reveal" && last && (
        <RevealPhase slates={slates} picks={picks} ledger={last.cards} net={last.net} accent={accent} onDone={() => setPhase("announce")} />
      )}

      {phase === "announce" && last && (
        <AnnouncePhase
          roomKey={roomKey}
          accent={accent}
          won={last.won}
          playerCards={last.playerCards}
          bossCards={last.bossCards}
          net={last.net}
          note={`${oppName} reads at ${oppWinPct}% · ${last.bossMode === "top" ? "TOP stakes" : "MATCH stakes"}`}
          cta={roundIndex + 1 >= rules.rounds ? "See the tally ›" : "Next round ›"}
          onCta={nextRound}
          onQuit={onQuitGame}
          bossName={oppName}
          username={username}
        />
      )}

      {/* §3.2 — beat the FLOOR BOSS → dethrone + key drop. */}
      {phase === "roomResult" && cleared && isBoss && (
        <KeyDropPhase
          roomKey={roomKey}
          accent={accent}
          bossName={oppName}
          roundsWon={roundsWon}
          totalRounds={rules.rounds}
          onDone={onCleared}
        />
      )}

      {/* §3.2 — beat an UNDERLING → its own screen: no throne, no key. */}
      {phase === "roomResult" && cleared && !isBoss && (
        <UnderlingBeatenPhase
          accent={accent}
          name={oppName}
          winPct={oppWinPct}
          art={opponent?.art}
          roundsWon={roundsWon}
          totalRounds={rules.rounds}
          bossName={rules.boss}
          onDone={onCleared}
        />
      )}

      {phase === "roomResult" && !cleared && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>
            {oppName.toUpperCase()}
          </div>
          <div className="font-serif text-4xl" style={{ color: accent }}>
            Boss holds the room
          </div>
          <div className="text-sm text-muted">
            You took {roundsWon} of {rules.rounds} rounds.
          </div>
          <button
            onClick={onExit}
            className="mt-4 rounded-xl border px-8 py-4 text-lg font-extrabold text-foreground"
            style={{ borderColor: accent, background: `${accent}22` }}
          >
            Back to the map ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- HOW TO PLAY (Dojo, item 5) ---------------- */
function HowToPlay({ accent, onDismiss }: { accent: string; onDismiss: () => void }) {
  const steps: [string, string][] = [
    ["Choose your ground", "Pick which categories the round deals from."],
    ["Cards are dealt", "The Locksmith deals you a hand of slates on the table."],
    ["Keep or discard", "Tap the cards you like to keep them; leave the rest to discard."],
    ["Redeal once", "Swap your discards for a fresh draw — one redeal per round."],
    ["Stake", "Put coins on each card you want to play. Play as few as one."],
    ["Lock in", "Answer your staked cards, then lock the round."],
    ["Reveal", "The cards turn over — win a card by getting most of its questions right."],
  ];
  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto p-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>THE DOJO</div>
          <div className="font-serif text-2xl text-foreground">How to play</div>
        </div>
        <button onClick={onDismiss} className="rounded-lg border border-border px-4 py-1.5 text-sm font-bold text-muted">
          Skip
        </button>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {steps.map(([t, d], i) => (
          <div key={t} className="flex gap-3">
            <div
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-extrabold"
              style={{ border: `1px solid ${accent}`, color: accent }}
            >
              {i + 1}
            </div>
            <div>
              <div className="font-bold text-foreground">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onDismiss}
        className="mt-6 w-full rounded-xl py-4 text-lg font-extrabold text-white"
        style={{ background: accent }}
      >
        Start playing ›
      </button>
    </div>
  );
}

/* ---------------- dealing: cards dealt out on the Locksmith table ---------------- */
/* ---------------- pre-round beat — pick the fight (MATCH / TOP) ----------------
 * Categories are chosen in the LOCKER now (A5), so this beat only sets the boss stake mode
 * (item 4) before the deal. */
function BossModePhase({
  accent, stakes, bossName, bossMode, onBossMode, onDone, cardMin,
}: {
  accent: string;
  stakes: number[];
  bossName: string;
  bossMode: BossStakeMode;
  onBossMode: (m: BossStakeMode) => void;
  onDone: (dealCount: number) => void;
  cardMin: number;
}) {
  // CARD-COUNT chooser (defect 4). Legal range = [cardMin, MAX] from the floor: Owl/Ghost/Wolf 1–5,
  // Grim 4–5, Raven/Fox 5 only. When cardMin == MAX the selector renders LOCKED with the reason.
  const MAX_CARDS = SLATES_PER_ROUND;
  const locked = cardMin >= MAX_CARDS;
  const [dealCount, setDealCount] = useState(MAX_CARDS);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>THE FIGHT</div>
        <div className="mt-1 font-serif text-2xl text-foreground">How does {bossName} stake?</div>
      </div>
      <div className="flex w-full max-w-sm gap-2">
        {([
          ["match", "Match", "Stakes at your tier — even fight."],
          ["top", "Top", `Stakes ${stakes[stakes.length - 1]} ⛃ every card — harder, bigger pot.`],
        ] as const).map(([m, label, desc]) => {
          const on = bossMode === m;
          return (
            <button
              key={m}
              onClick={() => onBossMode(m)}
              className="flex-1 rounded-xl border p-4 text-left"
              style={{ borderColor: on ? accent : "var(--border)", background: on ? `${accent}22` : "transparent" }}
            >
              <div className="text-base font-extrabold" style={{ color: on ? accent : "var(--foreground)" }}>{label}</div>
              <div className="mt-1 text-[12px] text-muted">{desc}</div>
            </button>
          );
        })}
      </div>
      {/* CARD-COUNT chooser — always rendered (locked at the boss's count when min==max) */}
      <div className="w-full max-w-sm">
        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-widest text-muted">How many cards?</div>
        <div className="flex justify-center gap-2">
          {Array.from({ length: MAX_CARDS }, (_, i) => i + 1).map((n) => {
            const allowed = n >= cardMin && n <= MAX_CARDS;
            const on = dealCount === n;
            return (
              <button
                key={n}
                onClick={() => allowed && !locked && setDealCount(n)}
                disabled={!allowed || locked}
                className="h-11 w-11 rounded-lg border text-base font-extrabold"
                style={{
                  borderColor: on ? accent : "var(--border)",
                  background: on ? accent : "transparent",
                  color: on ? "#fff" : allowed ? "var(--foreground)" : "#5a6675",
                  opacity: allowed ? 1 : 0.4,
                  cursor: allowed && !locked ? "pointer" : "not-allowed",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-center text-[11px] font-semibold" style={{ color: locked ? accent : "var(--muted, #6B7A8E)" }}>
          {locked ? `${bossName} requires ${cardMin}.` : cardMin > 1 ? `${bossName} requires at least ${cardMin}.` : "Your call — 1 to 5."}
        </div>
      </div>
      <button
        onClick={() => onDone(dealCount)}
        className="w-full max-w-sm rounded-xl border px-6 py-4 text-base font-extrabold"
        style={{ borderColor: accent, background: `${accent}22`, color: "var(--foreground)" }}
      >
        Deal {dealCount} card{dealCount > 1 ? "s" : ""} ›
      </button>
    </div>
  );
}

function DealingTable({
  roomKey, accent, count, bossFirst, onDone,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  count: number;
  bossFirst: boolean;
  onDone: () => void;
}) {
  const TOTAL = Math.max(1, count) * 2; // `count` to the boss, `count` to you
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
  // CLUSTER both fans ON the green felt (~46%–77% of the frame) — centered on the felt and spread to
  // FIT whatever the count is, so even Coliseum's 5-per-fan land on the table surface instead of
  // fanning off its left edge. The boss's fan sits across the far side, yours nearest the viewer.
  const perFan = Math.max(1, Math.ceil(TOTAL / 2));
  const FELT_CENTER = 61; // % — middle of the baked table's felt
  const FELT_SPAN = 26; // % — usable felt width (inset from the 46–77 felt so cards stay on it)
  const step = perFan > 1 ? FELT_SPAN / (perFan - 1) : 0;
  const cards = Array.from({ length: TOTAL }, (_, i) => {
    const toBoss = bossFirst ? i % 2 === 0 : i % 2 === 1;
    const slot = Math.floor(i / 2); // 0..(perFan-1) across each fan
    const x = FELT_CENTER - FELT_SPAN / 2 + slot * step;
    return { i, toBoss, x, y: toBoss ? 55 : 70 };
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

/* ---------------- deal / keep-N phase ---------------- */
export function DealPhase({
  slates, kept, redealsLeft, accent, onToggle, onRedeal, onPlay, onAutoPlay,
}: {
  slates: FoxSlate[];
  kept: Set<string>;
  redealsLeft: number;
  accent: string;
  onToggle: (id: string) => void;
  onRedeal: () => void;
  onPlay: () => void;
  onAutoPlay: () => void;
}) {
  // Decision clock: if it runs out, the hand you're holding LOCKS IN and the
  // game begins (no keep/discard penalty prompt).
  const [left, setLeft] = useState<number>(TIMERS.discardDecision);
  const [opened, setOpened] = useState<FoxSlate | null>(null);
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0) {
      if (!fired.current) { fired.current = true; onAutoPlay(); }
      return;
    }
    // 3.3: reading time is not decision time — the clock PAUSES while a card is open full screen.
    if (opened) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, opened, onAutoPlay]);

  // A: the OPENED overlay must be dismissible by hardware/gesture back too — push a history entry on
  // open, close on popstate. Close/tap-outside route through history.back() so every dismissal is one
  // path (the pushed entry is always consumed) and back never leaves the game from the overlay.
  useEffect(() => {
    if (!opened) return;
    window.history.pushState({ fpOpened: 1 }, "");
    const onPop = () => setOpened(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [opened]);
  const closeOpened = () => window.history.back();

  // FoxSlate questions -> read-only SlateCard legs for the opened full-screen card. No context strip
  // (Fox Pit trivia has none). Reading the question is how you decide keep vs throw-back.
  const legsFor = (s: FoxSlate): SlateLeg[] =>
    s.questions.map((q) => ({ question: q.text, state: "neutral" as const, picks: q.options.map((o) => ({ label: o })) }));

  return (
    <div className="flex flex-1 flex-col gap-3 p-4 pb-28">
      <div className="self-center rounded-full border px-4 py-1 text-sm font-extrabold"
        style={{ borderColor: accent, color: left <= 5 ? "#E85454" : accent }}>
        {left}s
      </div>
      <div className="text-center text-sm text-muted">
        Tap a card to read its question — keep the ones you like, throw the rest back for one redeal, then play them at the table.
      </div>
      {/* dealt minis — the uniform SlateCard face variant (baked Fox Pit face + category ring, ZERO
          question text). Tap opens the SAME card full screen, carrying the question. */}
      <div className="flex flex-wrap justify-center gap-2">
        {slates.map((s) => {
          const tint = slateTint(s);
          return (
            <div key={s.id} className="relative w-[31%] min-w-[100px]">
              <button onClick={() => setOpened(s)} className="block w-full text-left" aria-label={`Read ${s.title}`}>
                <SlateCard mode="foxpit" currency="coins" catColor={tint.color}
                  faceImage={CARD_FRONT} eyebrow={s.category} title={s.title} legs={[]} stakeMode="none" />
              </button>
              <button
                onClick={() => onToggle(s.id)}
                className="absolute bottom-1 right-1 z-10 rounded px-1 text-[8px] font-extrabold uppercase"
                style={{ color: kept.has(s.id) ? "#03040A" : tint.color, background: kept.has(s.id) ? tint.color : "rgba(3,4,7,.72)", border: `1px solid ${tint.color}` }}
              >
                {kept.has(s.id) ? "kept ✓" : "keep"}
              </button>
            </div>
          );
        })}
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

      {/* OPENED — the SAME card, full screen, carrying the full question(s). Read, then keep or throw back. */}
      {opened && (() => {
        const tint = slateTint(opened);
        return (
          // 1.2: FULLY OPAQUE over the deal grid + the bottom bar (was bg-background/95, which let
          // "Redeal / To the table" bleed through). Column layout — NOT centered — so a tall card scrolls
          // to its end instead of overflowing past the bezel.
          <div
            data-opened-overlay
            className="fixed inset-0 z-50 flex flex-col bg-background p-4"
            style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 16px)", paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 16px)" }}
            onClick={closeOpened}
          >
            <div className="mx-auto flex min-h-0 w-full max-w-[340px] flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
              {/* 1.1: the card body SCROLLS BY GESTURE (touch/drag) — every question + option reachable,
                  never a visible scrollbar (global UI rule; belt-and-braces inline for the webview). */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ scrollbarWidth: "none" }}>
                {/* 3.1: the OPENED card leads with the QUESTION — no face art pushing it off-screen.
                    (The frozen card_front_single.png face stays on the dealt MINI, not here.)
                    1.3: options render READ-ONLY (pickStyle="plain") — you read + decide keep/toss here;
                    answering happens later at the table. */}
                <SlateCard mode="foxpit" currency="coins" catColor={tint.color}
                  eyebrow={opened.category} title={opened.title}
                  readOnly stakeMode="none" pickStyle="plain" legs={legsFor(opened)} />
              </div>
              <div className="mt-3 flex shrink-0 gap-2">
                <button onClick={() => onToggle(opened.id)} className="flex-1 rounded-xl border py-3 text-sm font-bold"
                  style={{ borderColor: tint.color, color: tint.color }}>
                  {kept.has(opened.id) ? "Kept ✓ — throw back" : "Keep this card"}
                </button>
                <button data-close onClick={closeOpened} className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-foreground">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ---------------- play phase ---------------- */
function PlayPhase({
  slates, picks, stakes, unlockedStakes, categoryCount, expired, accent, canLock, cardMin, playedCount, bossName, onStake, onPlayCount, onPick, onLock,
}: {
  slates: FoxSlate[];
  picks: Record<string, number>;
  stakes: number[];
  unlockedStakes: number[];
  categoryCount: number;
  /** The round clock lives in the parent header now; PlayPhase only needs the expiry flag. */
  expired: boolean;
  accent: string;
  canLock: boolean;
  cardMin: number;
  playedCount: number;
  bossName: string;
  onStake: (id: string, stake: number) => void;
  onPlayCount: (id: string, n: number) => void;
  onPick: (qid: string, optionIndex: number) => void;
  onLock: () => void;
}) {
  // The round timer + auto-lock now live in the parent (the clock pins in the header). `expired` is
  // passed in; the footer surfaces it as the "Settle (time up)" state.

  // Reserve EXACT bottom space so the LAST card's questions + stake clear the fixed footer + nav bar.
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerH, setFooterH] = useState(150);
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => setFooterH(el.offsetHeight);
    measure();
    let ro: ResizeObserver | undefined;
    try {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } catch (err) {
      console.error("[foxpit] footer ResizeObserver failed", err);
    }
    return () => ro?.disconnect();
  }, []);

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-4"
      style={{ paddingBottom: `calc(${footerH}px + env(safe-area-inset-bottom, 0px) + 16px)` }}
    >
      {/* The round clock now lives in the sticky header (visible on every round screen); no in-body pill. */}

      {slates.map((s, i) => {
        const tint = slateTint(s); // app-wide category color canon
        const locked = isLocked(s, picks);
        // Play only the questions the player chose (defect 5b); those gate the stake + score.
        const maxQ = s.questions.length;
        const shown = s.questions.slice(0, s.playCount);
        // Stake gates on a FULLY-ANSWERED card — you can't size a bid before reading the hand.
        const answered = shown.every((q) => picks[q.id] != null);
        // Fewer questions = smaller stake ceiling: card tiers = the lowest min(breadth, playCount).
        const cardUnlockedStakes = stakes.slice(0, Math.min(unlockedStakes.length, s.playCount));
        return (
        <div
          key={s.id}
          className={`rounded-xl border-2 p-4 transition ${locked ? "border-accent bg-accent/10" : ""}`}
          style={locked ? undefined : { borderColor: tint.border }}
        >
          {/* DOM order: category → slate title → questions → stake (verified top-to-bottom) */}
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
          {/* HOW MANY QUESTIONS to play on this card (defect 5b) — 1..max; more = bigger stake ceiling */}
          {maxQ > 1 && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Play</span>
              <div className="flex gap-1">
                {Array.from({ length: maxQ }, (_, k) => k + 1).map((n) => {
                  const on = s.playCount === n;
                  return (
                    <button
                      key={n}
                      onClick={() => onPlayCount(s.id, n)}
                      className="h-7 w-7 rounded-md border text-xs font-extrabold"
                      style={{ borderColor: on ? accent : "var(--border, #1E2A38)", background: on ? accent : "transparent", color: on ? "#fff" : "#8b98a6" }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-muted">of {maxQ}Q · more = higher stakes</span>
            </div>
          )}
          {/* QUESTIONS — read the hand FIRST, before sizing the bid */}
          <div className="flex flex-col gap-2">
            {shown.map((q) => (
              <div key={q.id}>
                <div className="mb-1 text-sm text-foreground">{q.text}</div>
                {/* 4-option multiple choice (settled past fact) — vertical, A–D labelled */}
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt, oi) => {
                    const sel = picks[q.id] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => onPick(q.id, oi)}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold"
                        style={{ borderColor: sel ? accent : "var(--border, #1E2A38)", background: sel ? `${accent}22` : "transparent", color: sel ? "#fff" : "#c3cedb" }}
                      >
                        <span className="shrink-0 text-xs font-extrabold" style={{ color: sel ? accent : "#6B7A8E" }}>{String.fromCharCode(65 + oi)}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* STAKE — BELOW the questions, DISABLED until the whole card is answered (never hidden) */}
          <div id={`stake-${s.id}`} className="mt-3">
            {!answered ? (
              <div
                className="rounded-lg border border-dashed px-3 py-2 text-center text-[12px] font-semibold"
                style={{ borderColor: "var(--border, #1E2A38)", color: "#6b7a8e" }}
              >
                Answer this slate to set your stake.
              </div>
            ) : (
              <>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#8b98a6" }}>
                  Set your stake
                </div>
                {/* stake tier — breadth unlocks the lowest N tiers; higher tiers render LOCKED (item 3) */}
                <div className="flex flex-wrap gap-2">
                  {stakes.map((st, ti) => {
                    const unlocked = cardUnlockedStakes.includes(st);
                    const selected = s.stake === st;
                    return (
                      <button
                        key={st}
                        onClick={() => unlocked && onStake(s.id, st)}
                        disabled={!unlocked}
                        className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-extrabold"
                        style={{
                          borderColor: selected ? accent : "var(--border, #1E2A38)",
                          color: selected ? "#fff" : unlocked ? "#8b98a6" : "#5a6675",
                          background: selected ? accent : "transparent",
                          cursor: unlocked ? "pointer" : "not-allowed",
                          opacity: unlocked ? 1 : 0.55,
                        }}
                      >
                        {!unlocked && <LockGlyph size={11} />}
                        {st} ⛃{!unlocked ? ` · ${ti + 1} cats` : ""}
                      </button>
                    );
                  })}
                </div>
                {/* the reason a higher tier is locked (never hidden): whichever cap bites first —
                    this card's question count, or category breadth */}
                {stakes.length > cardUnlockedStakes.length && (
                  <div className="mt-1 text-[11px] font-semibold" style={{ color: "#8b98a6" }}>
                    {s.playCount <= unlockedStakes.length && s.playCount < stakes.length
                      ? `Play more questions on this card to raise the stake ceiling.`
                      : <>Play {unlockedStakes.length + 1} categor{unlockedStakes.length + 1 === 1 ? "y" : "ies"} to unlock {stakes[unlockedStakes.length]} ⛃<span className="text-[10px]"> (you played {categoryCount})</span></>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        );
      })}

      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border p-3"
        style={{ background: "#0A0D12", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
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
export function RevealPhase({
  slates, picks, ledger, net, accent, onDone,
}: {
  slates: FoxSlate[];
  picks: Record<string, number>;
  ledger: CardLedgerLine[];
  net: number;
  accent: string;
  onDone: () => void;
}) {
  const RESULT_COLOR: Record<CardLedgerLine["result"], string> = {
    win: COLOR_WIN,
    loss: COLOR_LOSS,
    push: "#6B7A8E",
  };
  const slateById = new Map(slates.map((s) => [s.id, s]));
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 pb-28">
      <div className="text-center text-sm font-extrabold tracking-widest" style={{ color: accent }}>
        THE CARDS COME OVER
      </div>
      {/* PER-CARD: the head-to-head ledger (you vs boss + the coin moved) AND every question's CORRECT
          answer with your pick — so practice actually teaches, not just scores. */}
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        {ledger.length === 0 && (
          <div data-reveal-empty className="rounded-xl border border-border p-4 text-center text-sm text-muted">
            No cards were staked this round — there was nothing to settle, and your coins are untouched.
            Deal again on the next round.
          </div>
        )}
        {ledger.map((c) => {
          const color = RESULT_COLOR[c.result];
          const tag = c.result === "win" ? `+${c.net} ⛃` : c.result === "loss" ? `−${Math.abs(c.net)} ⛃` : "PUSH";
          const slate = slateById.get(c.slateId);
          const shown = slate ? slate.questions.slice(0, Math.max(1, Math.min(slate.playCount, slate.questions.length))) : [];
          return (
            <div key={c.slateId} className="overflow-hidden rounded-xl border" style={{ borderColor: color }}>
              {/* header: card + H2H + coin */}
              <div className="flex items-center gap-2 border-b border-border p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase text-muted">{c.category}</div>
                  <div className="truncate font-serif text-xs text-foreground">{c.title}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end text-[9px] font-extrabold leading-tight">
                  <span style={{ color: c.playerCorrect ? COLOR_WIN : COLOR_LOSS }}>you {c.playerCorrect ? "✓" : "✗"}</span>
                  <span style={{ color: c.bossCorrect ? COLOR_WIN : COLOR_LOSS }}>boss {c.bossCorrect ? "✓" : "✗"}</span>
                </div>
                <div className="w-16 shrink-0 text-right text-sm font-extrabold" style={{ color }}>{tag}</div>
              </div>
              {/* per-question CORRECT ANSWER + your pick */}
              <div className="flex flex-col gap-2 p-2.5">
                {shown.map((q) => {
                  const pick = picks[q.id];
                  const right = pick === q.correctIndex;
                  return (
                    <div key={q.id}>
                      <div className="mb-0.5 text-xs text-foreground">{q.text}</div>
                      <div className="text-[11px] font-bold" style={{ color: COLOR_WIN }}>
                        ✓ {q.options[q.correctIndex]}{right ? "  (your pick)" : ""}
                      </div>
                      {!right && pick != null && (
                        <div className="text-[11px] font-semibold" style={{ color: COLOR_LOSS }}>
                          ✗ You picked: {q.options[pick]}
                        </div>
                      )}
                      {!right && pick == null && (
                        <div className="text-[11px] font-semibold text-muted">— not answered</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-center text-sm font-extrabold" style={{ color: net >= 0 ? COLOR_WIN : COLOR_LOSS }}>
        Round net {net >= 0 ? "+" : "−"}{Math.abs(net)} ⛃
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

/* ---------------- room cleared: the dethroned boss drops the key ---------------- */
export function KeyDropPhase({
  roomKey,
  accent,
  bossName,
  roundsWon,
  totalRounds,
  onDone,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  bossName: string;
  roundsWon: number;
  totalRounds: number;
  onDone: () => void;
}) {
  const room = roomByKey(roomKey);
  const key = KEY_ASSET[room.bossArt];
  const bossImg = DEFEATED_BOSS[roomKey];
  const isRaven = roomKey === "hightable";
  const [dropped, setDropped] = useState(false);
  const [showCta, setShowCta] = useState(false);
  useEffect(() => {
    const t1 = window.setTimeout(() => { setDropped(true); playCoinDrop(true); }, 550);
    const t2 = window.setTimeout(() => setShowCta(true), 1900);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* the room + its now-EMPTY throne (boss has been knocked off it) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[roomKey]} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5 }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,7,11,.7), rgba(5,7,11,.32) 34%, rgba(5,7,11,.92))" }} />

      {/* dethroned boss cutout — rises in, dropping/handing over the key */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bossImg}
        alt={`${bossName} dethroned`}
        draggable={false}
        className="absolute"
        style={{ bottom: "12%", left: "50%", transform: "translateX(-50%)", height: "58%", width: "auto", objectFit: "contain", filter: "drop-shadow(0 12px 30px rgba(0,0,0,.8))", animation: "foxpitFadeUp .8s ease both" }}
      />

      {/* the KEY falls from the boss to a glowing rest — the player claims it */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={key.src}
        alt={`${key.tier} key`}
        draggable={false}
        className="absolute"
        style={{
          left: "50%", top: "52%", height: 74, width: "auto",
          transform: `translateX(-50%) translateY(${dropped ? "0" : "-220%"}) rotate(${dropped ? "8deg" : "-40deg"})`,
          opacity: dropped ? 1 : 0,
          transition: "transform 1.1s cubic-bezier(.34,1.4,.5,1), opacity .5s ease",
          filter: `drop-shadow(0 0 18px ${accent})`,
        }}
      />
      {isRaven && dropped && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={RAVEN_FEATHER} alt="" aria-hidden className="absolute" style={{ left: "58%", top: "46%", height: 26, animation: "foxpitFadeUp 1.2s ease both" }} />
      )}

      {/* copy */}
      <div className="absolute inset-x-0 flex flex-col items-center gap-1 px-6 text-center" style={{ top: "8%" }}>
        <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>ROOM CLEARED</div>
        <div className="font-serif text-3xl text-foreground" style={{ textShadow: "0 2px 12px #000" }}>You dethroned {bossName}</div>
        <div className="text-sm font-bold" style={{ color: accent }}>The {key.tier} key is yours</div>
        <div className="mt-1 text-xs text-muted">You took {roundsWon} of {totalRounds} rounds · {bossName} will fight to reclaim the throne</div>
      </div>

      {/* claim CTA */}
      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom,0px) + 26px)" }}>
        {showCta && (
          <button
            onClick={onDone}
            className="rounded-xl border px-8 py-4 text-lg font-extrabold text-foreground"
            style={{ borderColor: accent, background: `${accent}22`, animation: "foxpitFadeUp .5s ease both" }}
          >
            Take the key ›
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- §3.2 underling beaten: no throne, no key — the seat clears, the boss still waits ---------------- */
function UnderlingBeatenPhase({
  accent, name, winPct, art, roundsWon, totalRounds, bossName, onDone,
}: {
  accent: string;
  name: string;
  winPct: number;
  art?: string;
  roundsWon: number;
  totalRounds: number;
  bossName: string;
  onDone: () => void;
}) {
  const [showCta, setShowCta] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowCta(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-6 text-center">
      {/* the underling steps back (fades down) — NOT dethroned, NO key. */}
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt={`${name} beaten`}
          draggable={false}
          className="mb-1 h-40 w-auto object-contain"
          style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,.7)) grayscale(.35)", opacity: 0.85, animation: "foxpitFadeUp .7s ease both" }}
        />
      )}
      <div className="text-xs font-extrabold tracking-widest" style={{ color: accent }}>TABLE CLEARED</div>
      <div className="font-serif text-4xl text-foreground" style={{ textShadow: "0 2px 12px #000" }}>You beat {name}</div>
      <div className="text-sm text-muted">
        {name} read at {winPct}% — you took {roundsWon} of {totalRounds} rounds. The seat is yours.
      </div>
      {/* the KEY is the boss's — say so, so this never reads like a room clear. */}
      <div className="mt-1 text-sm font-bold" style={{ color: accent }}>
        {bossName} still holds the key — clear every table, then take the throne.
      </div>
      {showCta && (
        <button
          onClick={onDone}
          className="mt-5 rounded-xl border px-8 py-4 text-lg font-extrabold text-foreground"
          style={{ borderColor: accent, background: `${accent}22`, animation: "foxpitFadeUp .5s ease both" }}
        >
          Back to the floor ›
        </button>
      )}
    </div>
  );
}

/* ---------------- announce: the Locksmith calls it at the table + coin drop ---------------- */
function AnnouncePhase({
  roomKey, accent, won, playerCards, bossCards, net, note, cta, onCta, onQuit, bossName, username,
}: {
  roomKey: FoxPitRoomKey;
  accent: string;
  won: boolean;
  playerCards: number;
  bossCards: number;
  net: number;
  note: string;
  cta: string;
  onCta: () => void;
  onQuit: () => void;
  bossName: string;
  username: string;
}) {
  useEffect(() => { playCoinDrop(won); }, [won]);
  // Every Fox Pit opponent is a boss → the BOSS winner-table (her + table baked into ONE sprite).
  // The raised arm points at the winner's seat: player win = RIGHT arm, boss win = LEFT arm.
  const table = won ? WINNER_TABLE_BOSS_RIGHT : WINNER_TABLE_BOSS_LEFT;
  // 4.2: the winner is named by the PLAYER'S USERNAME, never "You".
  const winnerName = won ? username : bossName;
  // Raised-hand anchor (fraction of the 1264² sprite): name centers here, just above the glove.
  const handX = won ? 68 : 32;

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[roomKey]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 55% at 50% 50%, transparent, rgba(3,4,7,.8))" }} />

      {/* Winner table — Locksmith + table in ONE sprite (the old her-alone + bare-table composite
          is gone). The winner's NAME renders over her raised hand, ABOVE the sprite in z-order. */}
      <div className="relative z-[1]" style={{ height: "62%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={table} alt="The Locksmith announces the winner" className="block h-full w-auto object-contain" />

        {/* coin POT (item 7): stake coins gather from BOTH sides to the middle, then push right. */}
        <div className="absolute z-[2]" style={{ left: "43%", top: "42%", animation: "foxpitPotPush 1.7s ease-in-out .1s both" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${(i % 4) * 7}px`,
                top: `${-i * 2.3}px`,
                width: 20,
                height: 20,
                background: "radial-gradient(circle at 35% 30%, #ffe9a8, #d9a521 60%, #8a6410)",
                boxShadow: "0 2px 6px rgba(0,0,0,.6)",
                animation: `${i % 2 === 0 ? "foxpitGatherL" : "foxpitGatherR"} .8s cubic-bezier(.3,1,.4,1) ${i * 0.05}s both`,
              }}
            />
          ))}
        </div>

        {/* winner's name over the raised hand (shrink-to-fit, never wraps over her arm) */}
        <div className="absolute z-[3]" style={{ left: `${handX}%`, top: "5%", transform: "translateX(-50%)", maxWidth: "40%" }}>
          <div
            className="rounded-md px-2 py-0.5 text-center font-serif font-extrabold"
            style={{ color: won ? COLOR_WIN : "#f5e3ac", background: "rgba(3,4,7,.6)", fontSize: "clamp(15px, 4vw, 26px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {winnerName}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-[4] flex flex-col items-center gap-1 p-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
      >
        <div className="font-serif text-3xl" style={{ color: won ? COLOR_WIN : accent }}>
          {won ? "You take the round" : "The boss takes it"}
        </div>
        <div className="text-sm font-bold text-foreground">
          YOU {playerCards} · BOSS {bossCards} <span style={{ color: net >= 0 ? COLOR_WIN : COLOR_LOSS }}>· {net >= 0 ? "+" : "−"}{Math.abs(net)} ⛃</span>
        </div>
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
