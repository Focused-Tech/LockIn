"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockGlyph } from "@/components/practice/LockGlyph";
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
} from "@/lib/foxpit";

type Phase = "door" | "room" | "table" | "faceoff" | "play";

/** The transparent round PLAYER-table cutout (tables only, no dealer) — one per
 *  selectable table, replacing the old green ellipse hotspots. */
const PLAYER_TABLE = "/foxpit/tables/table_player_round.png";

/** table positions per room (%, on the floor — one cutout per playable table;
 *  the count matches the room, e.g. Coliseum = 5. Tune on-device. */
const TABLE_POS: Record<number, [number, number][]> = {
  1: [[50, 66]],
  3: [[34, 68], [50, 71], [66, 68]],
  // 5 tables in a TIGHT cluster, numbered closest-first: table 1 nearest the
  // viewer (bottom), 4 & 5 farthest (top). Kept close but non-overlapping.
  5: [[50, 77], [30, 67], [70, 67], [37, 56], [63, 56]],
};
const PRIZE_KEY_POS: [number, number] = [50, 38]; // on the throne, above the table ring so it stays uncovered

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
const LOCKSMITH_PLAYER_TABLE = "/foxpit/tables/locksmith_player_table.png";
const LOCKSMITH_BOSS_TABLE = "/foxpit/tables/locksmith_boss_table.png";

export function FoxPitRoom({
  roomKey,
  username = "Member",
  avatarUrl = null,
}: {
  roomKey: FoxPitRoomKey;
  username?: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const room = roomByKey(roomKey);
  const [phase, setPhase] = useState<Phase>("door");
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [beaten, setBeaten] = useState<Set<number>>(new Set());
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

  const tables: [number, number][] = TABLE_POS[room.tables] ?? [[50, 66]];
  // Single-table rooms (Owl/Dojo, Boss Fox/Suite) seat you straight at the boss.
  // Multi-table rooms require beating every regular table first.
  const singleTable = tables.length === 1;
  const allBeaten = tables.every((_, i) => beaten.has(i));
  const bossReady = singleTable || allBeaten || roomCleared;
  // the table you're currently on = the first not-yet-beaten one (highlighted orange).
  const currentTableIdx = roomCleared ? -1 : tables.findIndex((_, i) => !beaten.has(i));

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

          {/* multi-table rooms: the boss waits on the throne — locked until every table is beaten */}
          {!singleTable && (
            <button
              onClick={() => bossReady && setPhase("faceoff")}
              disabled={!bossReady}
              style={{
                position: "absolute",
                left: "50%",
                top: "29%",
                transform: "translate(-50%,-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "8px 14px",
                borderRadius: 12,
                background: bossReady ? "rgba(20,10,4,.82)" : "rgba(3,4,7,.8)",
                border: `2px solid ${bossReady ? room.accent : "#3a4653"}`,
                boxShadow: bossReady ? `0 0 26px ${room.accent}aa` : "none",
                color: bossReady ? "#ffe" : "#c8a24b",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".06em",
                cursor: bossReady ? "pointer" : "not-allowed",
                filter: bossReady ? "none" : "grayscale(.4)",
                animation: bossReady ? "foxpitGlow 2.4s ease-in-out infinite" : "none",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {bossReady ? (
                `CHALLENGE ${room.boss.toUpperCase()} ›`
              ) : (
                <>
                  <LockGlyph size={18} />
                  <span>BEAT ALL {tables.length} TABLES</span>
                </>
              )}
            </button>
          )}

          {/* PLAYER TABLES — one round-table cutout per playable table (count matches
              the room). Beaten = dimmed + ✓; the table you're on = lock-in orange. */}
          {tables.map(([x, y], i) => {
            const done = roomCleared || beaten.has(i);
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
                onClick={() => { setActiveTable(i); setPhase("table"); }}
                aria-label={singleTable ? `Sit vs ${room.boss}` : `Table ${i + 1}`}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%,-50%) translate(${flyX}%, ${flyY}%)${isSel ? " scale(1.12)" : ""} perspective(420px) rotateX(50deg)`,
                  opacity: fly ? 0 : 1,
                  transition: "transform .55s cubic-bezier(.35,0,.2,1), opacity .5s ease",
                  width: singleTable ? 150 : 92,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  filter: done ? "grayscale(.45) brightness(.72)" : "none",
                  animation: isCurrent && !selecting ? "foxpitBob 2.6s ease-in-out infinite" : "none",
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
                      filter: isCurrent
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
                      color: done ? "#22C55E" : isCurrent ? "#FF3B00" : "#E7E7EB",
                      textShadow: "0 2px 6px #000, 0 0 8px #000",
                      textAlign: "center",
                      lineHeight: 1.1,
                      pointerEvents: "none",
                    }}
                  >
                    {singleTable ? `SIT · ${room.boss.toUpperCase()}` : done ? `✓ ${i + 1}` : `TABLE ${i + 1}`}
                  </div>
                </div>
              </button>
            );
          })}
        </>
      )}

      {/* ---------- TABLE panel ---------- */}
      {phase === "table" && activeTable !== null && (
        <TablePanel
          room={room}
          index={activeTable}
          freeKeycard={isFirstLoneRoom}
          username={username}
          avatarUrl={avatarUrl}
          bossTable={singleTable}
          onClose={() => { setPhase("room"); setActiveTable(null); }}
          onConfirm={() => setPhase("play")}
        />
      )}

      {/* ---------- PLAY: the isolated Fox Pit BOSS-JOURNEY coin game (keep-N deal,
           staked play, $-weighted vs the boss) — not real-money, not the arena ---------- */}
      {phase === "play" && (
        <FoxPitGame
          roomKey={room.key}
          onExit={() => { setPhase("room"); setActiveTable(null); }}
          onCleared={() => {
            markCleared(room.key);
            router.push("/app/foxpit/map");
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
      {phase !== "door" && phase !== "faceoff" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 108, zIndex: 63, background: "linear-gradient(180deg,rgba(3,4,7,.9),transparent)" }}>
          <button onClick={() => router.push("/app/foxpit/map")} style={hudBack}>‹ Map</button>
          <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center" }}>
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
  room, index, freeKeycard, username, avatarUrl, bossTable, onClose, onConfirm,
}: {
  room: ReturnType<typeof roomByKey>;
  index: number;
  freeKeycard: boolean;
  username: string;
  avatarUrl: string | null;
  bossTable: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 66, background: "#05070b", overflow: "hidden", animation: "foxpitFadeUp .35s ease both" }}>
      {/* the room's FLOOR tile — the base of the top-down deal */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FLOOR_IMG[room.key]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.92 }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(72% 60% at 50% 48%, transparent, rgba(3,4,7,.74))" }} />

      <button onClick={onClose} style={hudBack}>‹ Back</button>

      <div style={{ position: "absolute", top: 62, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: ".24em", color: room.accent, fontWeight: 800 }}>
          {bossTable ? "BOSS TABLE" : `TABLE ${index + 1}`}
        </div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#E7E7EB", marginTop: 2, textShadow: "0 2px 12px #000" }}>
          Dealt by the Locksmith
        </div>
      </div>

      {/* the DEAL — the Locksmith DEALER table (her seated at the edge, chips + tray +
          deck baked in) pulls up on the floor; you're seated across from her. */}
      <div style={{ position: "absolute", left: "50%", top: "51%", transform: "translate(-50%,-50%)", height: "82%", width: "96%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bossTable ? LOCKSMITH_BOSS_TABLE : LOCKSMITH_PLAYER_TABLE}
          alt="The Locksmith deals"
          style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 22px 34px rgba(0,0,0,.7))", animation: "foxpitTablePull .6s cubic-bezier(.2,.8,.2,1) both" }}
        />
      </div>

      {freeKeycard && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)", display: "flex", justifyContent: "center" }}>
          <MembershipCard username={username} avatarUrl={avatarUrl} width={170} />
        </div>
      )}

      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", display: "flex", justifyContent: "center", padding: "0 18px" }}>
        <button onClick={onConfirm} style={{ width: "100%", maxWidth: 380, border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "16px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
          {bossTable ? `Take your seat vs ${room.boss} ›` : "Deal me in ›"}
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
