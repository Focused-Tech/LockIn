"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockerRoom, type LockerChoice } from "./LockerRoom";
import { FoxPitGame } from "./FoxPitGame";
import {
  roomByKey,
  markCleared,
  getCleared,
  FOXPIT_ROOMS,
  KEY_ASSET,
  DOOR_EMBLEM,
  MEMBERSHIP_CARD,
  type FoxPitRoomKey,
  type BossArt,
} from "@/lib/foxpit";
import { underlingAt, underlingTableCount, secondTierOf, hasSecondTier, type Underling } from "@/lib/foxpit/underlings";
import { writeFoxCheckpoint, clearFoxCheckpoint } from "@/lib/foxpit/checkpoint";

type Phase = "locker" | "door" | "room" | "table" | "faceoff" | "play";

/** The transparent round PLAYER-table cutout (tables only, no dealer) — one per
 *  selectable table, replacing the old green ellipse hotspots. */
const PLAYER_TABLE = "/foxpit/tables/table_player_round.png";

/** table positions per room (%, on the floor — one cutout per playable table;
 *  the count matches the room, e.g. Coliseum = 5. Tune on-device. */
const TABLE_POS: Record<number, [number, number][]> = {
  1: [[50, 66]],
  3: [[34, 68], [50, 71], [66, 68]],
  // High Table — X FORMATION: 4 ravens on the arms of the X; the BOSS table sits at the crossing
  // (BOSS_TILE_POS.hightable). TL · TR · BL · BR — arms pushed wide so the centre boss has clearance.
  4: [[30, 52], [70, 52], [30, 82], [70, 82]],
  // Coliseum — ✳ FORMATION: 5 wolves on the spokes; the BOSS table sits at the centre
  // (BOSS_TILE_POS.coliseum). Top · upper-right · lower-right · lower-left · upper-left. Tightened to
  // the X's footprint; the top spoke is pulled DOWN off the throne, rows stay ≥8% apart in Y.
  5: [[50, 57], [70, 65], [63, 86], [37, 86], [30, 65]],
};
const PRIZE_KEY_POS: [number, number] = [50, 38]; // on the throne, above the table ring so it stays uncovered

/** The BOSS TABLE tile position — the last selectable table (Coliseum's 6th, High Table's 5th). Sits
 *  ABOVE the tuned underling cluster and below the throne/key so it never overlaps a player table. */
const BOSS_TILE_POS: Partial<Record<FoxPitRoomKey, [number, number]>> = {
  coliseum: [50, 74], // centre of the ✳ — a clear row below the two upper spokes
  hightable: [50, 67], // crossing of the X
};

/** Host intro blurb — shown on the boss name-card when the doors open. The boss is
 *  the HOST of the room (not necessarily the first challenger). */
const ROOM_BLURB: Record<FoxPitRoomKey, string> = {
  dojo: "The Owl runs the training floor. Sharpen your reads before you climb.",
  coliseum: "Alpha Wolf hosts the Coliseum — five tables, one roaring crowd. Fight your way to his throne.",
  hightable: "Raven presides over the High Table. Refined, ruthless, watching every pick.",
  suite: "Boss Fox's private suite. The last door — beat him and the Pit is yours.",
};

/** Locksmith welcomes you in as the usher — stands at the door BEFORE it opens. */
const LOCKSMITH_USHER = "/foxpit/locksmith/locksmith_usher.png";

/** Door-reveal figure override: the Coliseum reveals GHOST (its second-tier boss)
 *  standing, the way Raven's Nest reveals its own. Falls back to the room's avatar. */
const REVEAL_IMG: Partial<Record<FoxPitRoomKey, string>> = {
  coliseum: "/foxpit/greeters/ghost_standing.png",
};

/** Per-room floor tile — the base of the top-down deal scene. */
const FLOOR_IMG: Record<FoxPitRoomKey, string> = {
  dojo: "/foxpit/floors/floor_dojo.png",
  coliseum: "/foxpit/floors/floor_coliseum.png",
  hightable: "/foxpit/floors/floor_ravensnest.png",
  suite: "/foxpit/floors/floor_foxden.png",
};
/** Locksmith DEALER tables (top-down: she's seated at the edge, chip stacks, tray,
 *  and the LockIn deck all baked in) — the table that pulls up when you sit. */
/** §2.1 — the BALLROOM PLATE art: each opponent seated at the table with their hand of LockIn cards.
 *  Underlings use their own per-character asset (opponent.art = cutouts/underling_<name>_<clan>.png);
 *  bosses use the with-cards boss sheet, mapped by bossArt (TL Owl · TR Wolf · BL Raven(female) · BR Fox).
 *  All are green-screen source — ChromaFigure keys the green out at paint. */
const BOSS_PLATE_WITH_CARDS: Record<BossArt, string> = {
  owl: "/foxpit/review/bosses_cards_TL.png",
  wolf: "/foxpit/review/bosses_cards_TR.png",
  raven: "/foxpit/review/bosses_cards_BL.png",
  fox: "/foxpit/review/bosses_cards_BR.png",
};

/** Draws a green-screen PNG to a canvas and keys the chroma green to transparent, so the seated
 *  opponent composites onto the plate cleanly (same-origin assets → canvas never taints). */
function ChromaFigure({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const c = ref.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        const frame = ctx.getImageData(0, 0, c.width, c.height);
        const p = frame.data;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i] ?? 0, g = p[i + 1] ?? 0, b = p[i + 2] ?? 0;
          // chroma green: green clearly dominant over red+blue → cut to transparent; de-spill the
          // near-edge greens a touch so there's no hard green halo on the figure.
          if (g > 95 && g > r * 1.35 && g > b * 1.35) {
            p[i + 3] = 0;
          } else if (g > r + 24 && g > b + 24) {
            p[i + 1] = Math.round((r + b) / 2 + 12);
          }
        }
        ctx.putImageData(frame, 0, 0);
      } catch (err) {
        console.error("[foxpit] chroma key failed", err);
      }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return <canvas ref={ref} aria-label={alt} role="img" style={style} />;
}

export function FoxPitRoom({
  roomKey,
  username = "Member",
  avatarUrl = null,
  categories = [],
  coinBalance = 0,
  resumeTable = null,
  resumeRound = 0,
}: {
  roomKey: FoxPitRoomKey;
  username?: string;
  avatarUrl?: string | null;
  categories?: string[];
  /** §3.3 — the player's coin balance at entry; the in-game chrome shows it and bumps it on a win. */
  coinBalance?: number;
  /** §3.1 — resume: land straight on this table's seat (0-based) at this round. null = normal entry. */
  resumeTable?: number | null;
  resumeRound?: number;
}) {
  const router = useRouter();
  const room = roomByKey(roomKey);
  // The Dojo runs: LOCKER (keys, category + avatar picks) → "Enter the Dojo" → the Locksmith door
  // opens with the Owl reveal (canon steps 2-3) → the room. Every other room skips the locker and
  // opens straight on the door + boss reveal.
  // §3.1 — a resume deep-link (?table=…) jumps straight to that table's seat (TablePanel), skipping
  // the door/locker; the round is carried into the game via nextInitialRound.
  const [phase, setPhase] = useState<Phase>(
    resumeTable != null ? "table" : roomKey === "dojo" ? "locker" : "door",
  );
  const [lockerChoice, setLockerChoice] = useState<LockerChoice | null>(null);
  const [activeTable, setActiveTable] = useState<number | null>(resumeTable);
  // §3.1 — the round the NEXT game mounts at: the resumed round for the resumed table, 0 for any
  // table the player picks fresh afterward (reset in the table/throne tap handlers).
  const [nextInitialRound, setNextInitialRound] = useState<number>(resumeTable != null ? resumeRound : 0);
  const [beaten, setBeaten] = useState<Set<number>>(new Set());
  // C: the floor-boss fight (the throne) vs an underling table. Set when the boss is challenged.
  const [bossFight, setBossFight] = useState(false);
  const [roomCleared, setRoomCleared] = useState(false);
  const [zoom, setZoom] = useState(false);
  const isFirstLoneRoom = room.key === "dojo";

  // already-cleared rooms skip the table grind (the boss is available straight away)
  useEffect(() => {
    setRoomCleared(getCleared().has(room.key));
  }, [room.key]);

  // door-unlock intro auto-advances to the room; the slow cut-in then plays.
  // Long fallback so the boss REVEAL + art have room to breathe (the Enter button
  // lets an eager player skip ahead sooner).
  useEffect(() => {
    if (phase !== "door") return;
    const t = setTimeout(() => setPhase("room"), 16500);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== "room") return;
    const t = setTimeout(() => setZoom(true), 120); // slow push-in
    return () => clearTimeout(t);
  }, [phase]);

  // The FLOOR tables are the UNDERLING tables (Coliseum 5 wolves, High Table 4 ravens).
  // The room BOSS sits at his OWN separate table — the throne/faceoff — reached only after
  // the pack is cleared. Owl (Dojo) and Boss Fox (Suite) have no pack: one boss table.
  // Stage 2 ladder: underling tables → the 2nd-tier encounter (Ghost/Grim) → the boss table.
  // The SPOKES of the formation hold the underlings THEN the 2nd-tier (Coliseum ✳ = 4 + Ghost = 5
  // spokes; High Table X = 3 + Grim = 4 arms); the BOSS sits at the centre.
  const nUnderling = underlingTableCount(room.key);
  const roomHasSecondTier = hasSecondTier(room.key);
  const spokeCount = nUnderling + (roomHasSecondTier ? 1 : 0);
  const tables: [number, number][] = spokeCount > 0
    ? (TABLE_POS[spokeCount] ?? TABLE_POS[room.tables] ?? [[50, 66]])
    : [[50, 66]];
  // Single-table rooms (Owl/Dojo, Boss Fox/Suite) seat you straight at the boss.
  const singleTable = nUnderling === 0;
  const secondTierIdx = roomHasSecondTier ? nUnderling : -1; // the last spoke
  const allUnderlingsBeaten = Array.from({ length: nUnderling }).every((_, i) => beaten.has(i));
  const secondTierBeaten = !roomHasSecondTier || beaten.has(secondTierIdx);
  // The boss unlocks only after every underling AND the 2nd-tier are beaten.
  const bossReady = singleTable || (allUnderlingsBeaten && secondTierBeaten) || roomCleared;
  // the table you're currently on = the first not-yet-beaten spoke (highlighted orange).
  const currentTableIdx = roomCleared ? -1 : tables.findIndex((_, i) => !beaten.has(i));
  // The BOSS TABLE is the centre tile; the spokes precede it.
  const bossTilePos = BOSS_TILE_POS[room.key] ?? [50, 60];
  const renderTiles: [number, number][] = singleTable ? tables : [...tables, bossTilePos];
  const bossTileIdx = singleTable ? -1 : tables.length;
  // Who a given tile seats: the boss (centre), the 2nd-tier (last spoke), or an underling.
  const opponentForTile = (i: number): Underling | null => {
    if (singleTable || i === bossTileIdx) return null;
    if (i === secondTierIdx) return secondTierOf(room.key);
    return underlingAt(room.key, i);
  };
  const activeOpponent = (bossFight || singleTable) ? null : (activeTable !== null ? opponentForTile(activeTable) : null);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#0A0D12", overflow: "hidden" }}>
      {/* painted room interior with a slow cut-in */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={room.roomImg}
        alt={room.name}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: zoom ? "scale(1.16)" : "scale(1)",
          transition: "transform 5.5s cubic-bezier(.2,.6,.2,1)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,13,18,.5),transparent 24%,transparent 66%,rgba(10,13,18,.86))" }} />

      {/* ---------- ROOM phase: table hotspots + spinning prize key ---------- */}
      {(phase === "room" || phase === "table") && (
        <>
          {/* floating tiered PRIZE KEY — off to the side, clear of the throne back */}
          <div
            style={{
              position: "absolute",
              left: `${PRIZE_KEY_POS[0]}%`,
              top: `${PRIZE_KEY_POS[1]}%`,
              transform: "translate(-50%,-50%)",
              width: 88,
              height: 88,
              filter: `drop-shadow(0 0 26px ${room.accent}aa)`,
            }}
            aria-label="Prize key"
          >
            {/* animation lives on the img so it never overrides the container's centering */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={KEY_ASSET[room.bossArt].src}
              alt={`${room.boss} prize key`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                animation: "foxpitKeySpin 3.6s ease-in-out infinite, foxpitBob 3.6s ease-in-out infinite",
              }}
            />
          </div>
          <div style={{ position: "absolute", left: `${PRIZE_KEY_POS[0]}%`, top: `${PRIZE_KEY_POS[1] + 7}%`, transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".14em", color: "#e0cf9f", fontWeight: 800, textShadow: "0 2px 6px #000", whiteSpace: "nowrap" }}>
            {KEY_ASSET[room.bossArt].tier.toUpperCase()} KEY
          </div>

          {/* PLAYER TABLES + the BOSS TABLE (last tile) — one round-table cutout per selectable table.
              Underlings: beaten = dimmed + ✓; current = lock-in orange. Boss tile: locked (🔒) until
              every underling table is beaten, then it's the centred boss table. */}
          {renderTiles.map(([x, y], i) => {
            const isBossTile = i === bossTileIdx;
            const isSecondTierTile = i === secondTierIdx;
            const done = isBossTile ? roomCleared : (roomCleared || beaten.has(i));
            const bossLocked = isBossTile && !bossReady;
            // the 2nd-tier is locked until every underling table is beaten.
            const secondTierLocked = isSecondTierTile && !allUnderlingsBeaten && !roomCleared;
            const locked = bossLocked || secondTierLocked;
            const u = opponentForTile(i);
            const isCurrent = i === currentTableIdx;
            // when a table is picked, the others disperse OUTWARD (radially, in the
            // direction they sit) and fade; the picked one nudges up in scale.
            const selecting = activeTable !== null;
            const isSel = i === activeTable;
            const fly = selecting && !isSel;
            const ddx = x - 50, ddy = y - 64, dlen = Math.hypot(ddx, ddy) || 1;
            const flyX = fly ? (ddx / dlen) * 360 : 0;
            const flyY = fly ? (ddy / dlen) * 360 : 0;
            return (
              <button
                key={i}
                onClick={() => {
                  if (locked) return; // boss / 2nd-tier locked until the prior tier falls
                  if (isBossTile) {
                    setNextInitialRound(0); setBossFight(true); setActiveTable(null); setPhase("table");
                  } else {
                    setNextInitialRound(0); setBossFight(false); setActiveTable(i); setPhase("table");
                  }
                }}
                disabled={locked}
                aria-label={isBossTile ? `Boss table · ${room.boss}` : isSecondTierTile ? `2nd-tier · ${u?.name ?? ""}` : singleTable ? `Sit vs ${room.boss}` : `Table ${i + 1}`}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%,-50%) translate(${flyX}%, ${flyY}%)${isSel ? " scale(1.12)" : ""} perspective(420px) rotateX(50deg)`,
                  opacity: fly ? 0 : 1,
                  transition: "transform .55s cubic-bezier(.35,0,.2,1), opacity .5s ease",
                  width: singleTable ? 150 : isBossTile ? 92 : isSecondTierTile ? 88 : 80,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: locked ? "not-allowed" : "pointer",
                  filter: locked ? "grayscale(.5) brightness(.62)" : done ? "grayscale(.45) brightness(.72)" : "none",
                  animation: (isBossTile ? bossReady && !roomCleared : isCurrent) && !selecting ? "foxpitBob 2.6s ease-in-out infinite" : "none",
                }}
              >
                <div style={{ position: "relative", width: "100%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={PLAYER_TABLE}
                    alt=""
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      filter: isBossTile && !bossLocked
                        ? "drop-shadow(0 0 18px #FF3B00) drop-shadow(0 0 8px #FF3B00)" // orange boss bezel
                        : isSecondTierTile && !secondTierLocked && !done
                        ? "drop-shadow(0 0 15px #EF9F27) drop-shadow(0 0 6px #EF9F27)" // amber 2nd-tier bezel
                        : isCurrent
                        ? "drop-shadow(0 0 14px #FF3B00) drop-shadow(0 0 6px #FF3B00)"
                        : done
                          ? "drop-shadow(0 0 8px #22C55E88)"
                          : "drop-shadow(0 6px 12px rgba(0,0,0,.6))",
                    }}
                  />
                  {/* state label centered on the felt */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: singleTable ? 13 : 11,
                      fontWeight: 800,
                      letterSpacing: ".06em",
                      color: isBossTile ? (bossLocked ? "#c8a24b" : "#FF3B00")
                        : isSecondTierTile ? (done ? "#22C55E" : secondTierLocked ? "#c8a24b" : "#EF9F27")
                        : done ? "#22C55E" : isCurrent ? "#FF3B00" : "#E7E7EB",
                      textShadow: "0 2px 6px #000, 0 0 8px #000",
                      textAlign: "center",
                      lineHeight: 1.1,
                      pointerEvents: "none",
                    }}
                  >
                    {isBossTile
                      ? (roomCleared ? "✓ BOSS" : bossLocked ? "🔒 BOSS" : `BOSS · ${room.boss.toUpperCase()}`)
                      : isSecondTierTile
                      ? (done ? `✓ ${u?.name.toUpperCase() ?? "2ND"}` : secondTierLocked ? `🔒 ${u?.name.toUpperCase() ?? "2ND"}` : `2ND · ${u?.name.toUpperCase() ?? ""}`)
                      : singleTable
                      ? `SIT · ${room.boss.toUpperCase()}`
                      : done
                        ? "✓"
                        : u
                          ? `${u.name.toUpperCase()} · ${u.winPct}%`
                          : `TABLE ${i + 1}`}
                  </div>
                </div>
              </button>
            );
          })}
        </>
      )}

      {/* ---------- TABLE panel ---------- */}
      {phase === "table" && (activeTable !== null || bossFight) && (
        <TablePanel
          room={room}
          index={activeTable ?? 0}
          opponent={activeOpponent}
          freeKeycard={isFirstLoneRoom}
          username={username}
          avatarUrl={avatarUrl}
          bossTable={singleTable || bossFight}
          onClose={() => { setPhase("room"); setActiveTable(null); setBossFight(false); }}
          onConfirm={() => {
            // §3.1 — checkpoint the seat as the player sits (underling/normal tables only; the boss
            // throne isn't a resumable seat). Round is written from the game via onRound below.
            if (!bossFight && !singleTable && activeTable !== null) {
              writeFoxCheckpoint({ room: roomKey, table: activeTable, round: nextInitialRound });
            }
            setPhase("play");
          }}
        />
      )}

      {/* ---------- PLAY: the isolated Fox Pit BOSS-JOURNEY coin game (keep-N deal,
           staked play, $-weighted vs the boss) — not real-money, not the arena ---------- */}
      {/* ---------- LOCKER ROOM (Part A) — the Dojo's staging screen before the game ---------- */}
      {phase === "locker" && (
        <LockerRoom
          roomKey={room.key}
          playerCategories={categories}
          coinBalance={coinBalance}
          onBack={() => router.push("/app/foxpit/map")}
          onEnter={(choice) => { setLockerChoice(choice); setPhase("door"); }}
        />
      )}

      {phase === "play" && (
        <FoxPitGame
          roomKey={room.key}
          userCategories={lockerChoice?.categories ?? categories}
          username={username}
          coinBalance={coinBalance}
          initialRound={nextInitialRound}
          opponent={activeOpponent}
          oppArt={(bossFight || singleTable)
            ? BOSS_PLATE_WITH_CARDS[room.bossArt]
            : (activeOpponent?.art ?? BOSS_PLATE_WITH_CARDS[room.bossArt])}
          onRound={(r) => {
            // §3.1 — keep the checkpoint's round current as the match advances (seat tables only).
            if (!bossFight && !singleTable && activeTable !== null) {
              writeFoxCheckpoint({ room: roomKey, table: activeTable, round: r });
            }
          }}
          onExit={() => { setPhase("room"); setActiveTable(null); setBossFight(false); }}
          onQuitGame={() => router.push("/app/choose")}
          onCleared={() => {
            // C: beating an UNDERLING marks that table beaten (back to the room). The room clears
            // ONLY when the FLOOR BOSS (throne / single-table boss) is beaten.
            if (bossFight || singleTable) {
              // §3.1 — room done: drop the checkpoint so Continue doesn't resume a finished floor.
              clearFoxCheckpoint();
              markCleared(room.key);
              router.push("/app/foxpit/map");
            } else if (activeTable !== null) {
              const nextBeaten = new Set(beaten).add(activeTable);
              setBeaten(nextBeaten);
              // Stage 3 — advance the checkpoint to the NEXT uncleared spoke so Continue resumes the
              // table you haven't beaten yet, not the one you just cleared. No spoke left (2nd-tier
              // down, boss next) → drop the checkpoint (the boss isn't a resumable seat).
              const nextSpoke = Array.from({ length: spokeCount }).findIndex((_, i) => !nextBeaten.has(i));
              if (nextSpoke >= 0) writeFoxCheckpoint({ room: roomKey, table: nextSpoke, round: 0 });
              else clearFoxCheckpoint();
              setPhase("room");
              setActiveTable(null);
            }
          }}
        />
      )}

      {/* ---------- FACE-OFF (that room's boss, seated) ---------- */}
      {phase === "faceoff" && (
        <Faceoff
          room={room}
          onBack={() => setPhase("room")}
          onClear={() => {
            markCleared(room.key);
            router.push("/app/foxpit/map");
          }}
        />
      )}

      {/* ---------- DOOR-UNLOCK intro (standing avatar) ---------- */}
      {phase === "door" && <DoorIntro room={room} onEnter={() => setPhase("room")} />}

      {/* HUD (room/table phases) */}
      {phase !== "door" && phase !== "faceoff" && phase !== "locker" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 108, zIndex: 63, background: "linear-gradient(180deg,rgba(3,4,7,.9),transparent)" }}>
          <button onClick={() => router.push("/app/foxpit/map")} style={hudBack}>‹ Map</button>
          {/* Quit the GAME — always out to the Fox Pit LANDING (/app/choose, "The Fox Pit" front
              door). You're quitting the game, not dropping back to the lobby or the tower. */}
          <button onClick={() => router.push("/app/choose")} style={hudQuit}>Quit game</button>
          {/* title sits BELOW the ‹ Map / Quit game buttons so it never runs under them (the buttons
              are pinned at top:16; the header drops clear of them). */}
          <div style={{ position: "absolute", top: 60, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".1em", color: "#E7E7EB", textShadow: "0 2px 10px #000" }}>{room.name}</div>
            <div style={{ fontSize: 12, letterSpacing: ".2em", color: room.accent, fontWeight: 700, marginTop: 2 }}>HOST · {room.boss.toUpperCase()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- door-unlock intro: standing avatar slides up ---------------- */
function DoorIntro({ room, onEnter }: { room: ReturnType<typeof roomByKey>; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  // Owl + Raven reveal in the right corner (clear of their throne); Alpha Wolf +
  // Boss Fox reveal centered.
  const cornerReveal = room.bossArt === "owl" || room.bossArt === "raven";
  useEffect(() => {
    // Hold on the Locksmith usher + closed doors for ~3.4s so she's clearly seen
    // BEFORE the doors part and the boss is revealed.
    // Beat map: usher holds ~3.4s -> doors part (2.6s transition, fully open ~6.0s)
    // -> ONE BEAT (2s) on the revealed room -> boss rises ~8.0s -> name-card after.
    const t1 = setTimeout(() => setOpen(true), 3400);   // usher visible, then the doors part slowly
    const t2 = setTimeout(() => setPrompt(true), 10600); // prompt once the boss reveal has settled
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 64 }}>
      {/* two door leaves that part SLOWLY to reveal the warm room behind */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", background: "linear-gradient(90deg,#1d140b,#0d0906)", borderRight: "3px solid #0b0f15", boxShadow: "inset -30px 0 60px rgba(0,0,0,.6)", transform: open ? "translateX(-100%)" : "translateX(0)", transition: "transform 2.6s cubic-bezier(.6,0,.2,1)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%", background: "linear-gradient(270deg,#1d140b,#0d0906)", borderLeft: "3px solid #0b0f15", boxShadow: "inset 30px 0 60px rgba(0,0,0,.6)", transform: open ? "translateX(100%)" : "translateX(0)", transition: "transform 2.6s cubic-bezier(.6,0,.2,1)" }} />
      {/* warm spill */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(46% 34% at 50% 52%, ${room.accent}44, transparent 72%)`, opacity: open ? 1 : 0, transition: "opacity 1.8s ease 1s" }} />

      {/* LOCKSMITH usher — stands at the door and welcomes you IN before it opens;
          she steps aside / fades as the doors part and the boss is revealed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOCKSMITH_USHER}
        alt="The Locksmith ushers you in"
        style={{
          position: "absolute",
          bottom: 0,
          left: "3%",
          // sized against the boss avatars (70–82%); she's a shorter character, so
          // she lands just under them instead of reading as a door ornament.
          height: "74%",
          width: "auto",
          maxWidth: "62vw",
          objectFit: "contain",
          display: "block",
          opacity: open ? 0 : 1,
          transform: open ? "translateX(-14%)" : "translateX(0)",
          transition: "opacity 1s ease, transform 1.8s cubic-bezier(.6,0,.2,1)",
          filter: "drop-shadow(0 0 30px rgba(252,62,1,.35))",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* neon fox emblem on the closed doors (fades as the doors part) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={DOOR_EMBLEM}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          transform: "translate(-50%,-50%)",
          width: 176,
          maxWidth: "46%",
          objectFit: "contain",
          opacity: open ? 0 : 1,
          transition: "opacity .7s ease",
          filter: "drop-shadow(0 0 24px rgba(252,62,1,.5))",
          zIndex: 1,
        }}
      />

      {/* THAT boss is REVEALED only after the doors part — hidden behind the closed
          doors, then rises into view (a reveal, not a pre-placed figure). Position
          alternates by boss: Owl + Raven reveal in the RIGHT CORNER (clear of their
          throne in the art); Alpha Wolf + Boss Fox reveal CENTERED. A positioned
          wrapper owns the horizontal placement so the rise animation (translateY)
          can't fight it. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          height: cornerReveal ? "70%" : "82%",
          pointerEvents: "none",
          ...(cornerReveal
            ? { right: "2%" }
            : { left: "50%", transform: "translateX(-50%)" }),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={REVEAL_IMG[room.key] ?? room.avatarImg}
          alt={`${room.boss} standing`}
          style={{
            height: "100%",
            width: "auto",
            maxWidth: "94vw",
            objectFit: "contain",
            display: "block",
            filter: `drop-shadow(0 0 40px ${room.accent}66)`,
            // hidden until the doors are open; the rise is delayed to land AFTER they part
            opacity: open ? undefined : 0,
            // 4.6s delay off `open` = doors fully open (2.6s) + a 2s beat on the room.
            animation: open ? "foxpitAvatarUp 2.2s cubic-bezier(.2,.8,.2,1) 4.6s both" : "none",
          }}
        />
      </div>

      {/* HOST name-card — pops up once the boss is revealed: name + "host of" +
          the room's blurb + the enter CTA. */}
      {prompt && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)", display: "flex", justifyContent: "center", padding: "0 18px", animation: "foxpitFadeUp .7s ease both" }}>
          <div style={{ width: "100%", maxWidth: 380, borderRadius: 16, background: "linear-gradient(180deg, rgba(14,10,6,.88), rgba(6,7,11,.92))", border: `1.5px solid ${room.accent}`, boxShadow: `0 0 34px ${room.accent}55, 0 10px 30px rgba(0,0,0,.6)`, padding: "16px 18px 18px", textAlign: "center", backdropFilter: "blur(2px)" }}>
            <div style={{ fontSize: 11, letterSpacing: ".22em", color: room.accent, fontWeight: 800 }}>
              HOST · {room.floorLabel.toUpperCase()}
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 30, color: "#f5ead0", lineHeight: 1.1, marginTop: 4, textShadow: "0 2px 18px #000" }}>
              {room.boss}
            </div>
            <div style={{ width: 70, height: 2, margin: "10px auto", background: `linear-gradient(90deg,transparent,${room.accent},transparent)` }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "#cdd6e2", margin: 0 }}>
              {ROOM_BLURB[room.key]}
            </p>
            <button onClick={onEnter} style={{ marginTop: 16, width: "100%", border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "14px 26px", fontSize: 17, fontWeight: 800, cursor: "pointer" }}>
              {/* names lost their leading "The" (plaques read cleaner) — put the
                  article back in prose, except the possessive "Boss Fox's Suite". */}
              Enter {room.key === "suite" ? "" : "the "}{room.name} ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- table panel ---------------- */
function TablePanel({
  room, index, opponent, freeKeycard, username, avatarUrl, bossTable, onClose, onConfirm,
}: {
  room: ReturnType<typeof roomByKey>;
  index: number;
  opponent: Underling | null;
  freeKeycard: boolean;
  username: string;
  avatarUrl: string | null;
  bossTable: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // §2.1 — the ballroom plate matches THIS table's opponent: the boss (female Boss Raven on the High
  // Table) or the seated underling, each shown at the table WITH their hand of cards (green keyed).
  const plateArt = bossTable ? BOSS_PLATE_WITH_CARDS[room.bossArt] : (opponent?.art ?? BOSS_PLATE_WITH_CARDS[room.bossArt]);
  const plateName = bossTable ? room.boss : (opponent?.name ?? room.boss);
  const plateSub = bossTable ? `Host · ${room.floorLabel}` : (opponent ? `${opponent.winPct}% win rate` : "Dealt by the Locksmith");
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 66, background: "#05070b", overflow: "hidden", animation: "foxpitFadeUp .35s ease both" }}>
      {/* the room's FLOOR tile — the base of the top-down deal */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[room.key]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.92 }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(72% 60% at 50% 48%, transparent, rgba(3,4,7,.74))" }} />

      <button onClick={onClose} style={hudBack}>‹ Back</button>

      {/* §2.1 — THE BALLROOM PLATE (step 6): the opponent for THIS table, seated across with their
          hand of cards (the asset you made — green keyed out here). Positioned BELOW the top HUD so
          ‹ Back / ‹ Map / Quit game never overlap the header. The name/table/win-rate caption rides
          beneath the figure; "Take your seat" is the CTA at the bottom. */}
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 76px)",
          left: 0,
          right: 0,
          bottom: freeKeycard ? 214 : 132,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 16px",
        }}
      >
        <ChromaFigure
          src={plateArt}
          alt={`${plateName} seated at the table`}
          style={{ height: "78%", maxHeight: 460, width: "auto", maxWidth: "94%", display: "block", objectFit: "contain", filter: `drop-shadow(0 18px 34px rgba(0,0,0,.7)) drop-shadow(0 0 26px ${room.accent}55)`, animation: "foxpitFadeUp .5s ease both" }}
        />
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: ".24em", color: room.accent, fontWeight: 800 }}>
            {bossTable ? "BOSS TABLE" : `TABLE ${index + 1}`}
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#f5ead0", lineHeight: 1.1, textShadow: "0 2px 14px #000" }}>
            {plateName}
          </div>
          <div style={{ fontSize: 12, color: "#cdd6e2", fontWeight: 600, marginTop: 2 }}>
            {plateSub}
          </div>
        </div>
      </div>

      {freeKeycard && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)", display: "flex", justifyContent: "center" }}>
          <MembershipCard username={username} avatarUrl={avatarUrl} width={150} />
        </div>
      )}

      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", display: "flex", justifyContent: "center", padding: "0 18px" }}>
        <button onClick={onConfirm} style={{ width: "100%", maxWidth: 380, border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "16px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
          {bossTable ? `Take your seat vs ${room.boss} ›` : opponent ? `Sit vs ${opponent.name} ›` : "Deal me in ›"}
        </button>
      </div>
    </div>
  );
}

/** Fox Pit membership card — the member's avatar + name embedded on the art. */
function MembershipCard({ username, avatarUrl, width = 260 }: { username: string; avatarUrl: string | null; width?: number }) {
  return (
    <div style={{ position: "relative", width, aspectRatio: "1251 / 795", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MEMBERSHIP_CARD} alt="Fox Pit membership card" style={{ width: "100%", height: "100%", display: "block", borderRadius: 8 }} />
      {/* avatar badge (upper-left circle) — the member's own avatar, Boss Fox head as fallback */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl || "/arena/fox-crest.png"}
        alt=""
        style={{
          position: "absolute",
          left: "18.4%",
          top: "42%",
          transform: "translate(-50%,-50%)",
          width: "18%",
          aspectRatio: "1",
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
      {/* member name */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "77%",
          transform: "translate(-50%,-50%)",
          width: "62%",
          textAlign: "center",
          color: "#f0d79a",
          fontFamily: "Georgia, serif",
          fontWeight: 700,
          fontSize: Math.round(width * 0.05),
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {username}
      </div>
    </div>
  );
}
/* ---------------- face-off: the room's own boss seated across the table ---------------- */
function Faceoff({ room, onBack, onClear }: { room: ReturnType<typeof roomByKey>; onBack: () => void; onClear: () => void }) {
  const next = FOXPIT_ROOMS.find((r) => r.order === room.order + 1);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 68, background: "#0A0D12" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={room.faceoffImg} alt={`Face-off with ${room.boss}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(10,13,18,.4),transparent 40%,rgba(10,13,18,.9))" }} />
      <button onClick={onBack} style={hudBack}>‹ Back</button>
      <div style={{ position: "absolute", left: 0, right: 0, top: 90, textAlign: "center" }}>
        <div style={{ fontSize: 13, letterSpacing: ".24em", color: room.accent, fontWeight: 800 }}>FACE-OFF · {room.boss.toUpperCase()}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 42px)", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 40, color: "#f5ead0", letterSpacing: ".06em", textShadow: "0 2px 30px #000" }}>GAME BEGINS</div>
        <div style={{ fontSize: 14, color: "#c3cedb", marginTop: 8, letterSpacing: ".1em" }}>Real gameplay drops in here.</div>
        <button onClick={onClear} style={{ marginTop: 20, border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "16px 30px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
          {next ? `Clear room · win the ${room.boss} key ›` : "Win the tournament ›"}
        </button>
      </div>
    </div>
  );
}

const hudBack: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 8,
  zIndex: 65,
  border: "1px solid rgba(200,162,75,.5)",
  background: "rgba(3,4,7,.6)",
  color: "#d8c79b",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const hudQuit: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 8,
  zIndex: 65,
  border: "1px solid rgba(232,84,84,.5)",
  background: "rgba(3,4,7,.6)",
  color: "#e88",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
