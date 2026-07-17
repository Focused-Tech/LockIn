"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  roomByKey,
  markCleared,
  FOXPIT_ROOMS,
  KEY_ASSET,
  DOOR_EMBLEM,
  MEMBERSHIP_CARD,
  type FoxPitRoomKey,
} from "@/lib/foxpit";

type Phase = "door" | "room" | "table" | "faceoff";

/** table hotspot positions per room (%, on the painted table surface — tune after OTA). */
const TABLE_POS: Record<number, [number, number][]> = {
  1: [[50, 68]],
  3: [[34, 68], [50, 71], [66, 68]],
};
const PRIZE_KEY_POS: [number, number] = [50, 42]; // floats in front of the throne, clear of the throne back

export function FoxPitRoom({ roomKey }: { roomKey: FoxPitRoomKey }) {
  const router = useRouter();
  const room = roomByKey(roomKey);
  const [phase, setPhase] = useState<Phase>("door");
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  const isFirstLoneRoom = room.key === "dojo";

  // door-unlock intro auto-advances to the room; the slow cut-in then plays
  useEffect(() => {
    if (phase !== "door") return;
    const t = setTimeout(() => setPhase("room"), 3600);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== "room") return;
    const t = setTimeout(() => setZoom(true), 120); // slow push-in
    return () => clearTimeout(t);
  }, [phase]);

  const tables: [number, number][] = TABLE_POS[room.tables] ?? [[50, 66]];

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "foxpitKeySpin 3.6s ease-in-out infinite, foxpitBob 3.6s ease-in-out infinite",
              filter: `drop-shadow(0 0 26px ${room.accent}aa)`,
            }}
            aria-label="Prize key"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={KEY_ASSET[room.bossArt].src} alt={`${room.boss} prize key`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div style={{ position: "absolute", left: `${PRIZE_KEY_POS[0]}%`, top: `${PRIZE_KEY_POS[1] + 11}%`, transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".14em", color: "#e0cf9f", fontWeight: 800, textShadow: "0 2px 6px #000", whiteSpace: "nowrap" }}>
            {KEY_ASSET[room.bossArt].tier.toUpperCase()} KEY
          </div>

          {/* table hotspots — tilted flat onto the table surface */}
          {tables.map(([x, y], i) => (
            <button
              key={i}
              onClick={() => { setActiveTable(i); setPhase("table"); }}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%,-50%) perspective(360px) rotateX(56deg)",
                transformStyle: "preserve-3d",
                width: 116,
                height: 54,
                borderRadius: "50%",
                background: "rgba(28,107,64,.26)",
                border: `2px solid ${room.accent}`,
                boxShadow: `0 0 26px ${room.accent}88`,
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: ".08em",
                cursor: "pointer",
                animation: "foxpitGlow 2.4s ease-in-out infinite",
              }}
            >
              TABLE {i + 1}
            </button>
          ))}
        </>
      )}

      {/* ---------- TABLE panel ---------- */}
      {phase === "table" && activeTable !== null && (
        <TablePanel
          room={room}
          index={activeTable}
          freeKeycard={isFirstLoneRoom}
          onClose={() => { setPhase("room"); setActiveTable(null); }}
          onSeat={() => setPhase("faceoff")}
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
  useEffect(() => {
    const t1 = setTimeout(() => setOpen(true), 300);   // doors part
    const t2 = setTimeout(() => setPrompt(true), 2600); // prompt appears as avatar settles back
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 64 }}>
      {/* two door leaves that part to reveal the warm room behind */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", background: "linear-gradient(90deg,#1d140b,#0d0906)", borderRight: "3px solid #0b0f15", boxShadow: "inset -30px 0 60px rgba(0,0,0,.6)", transform: open ? "translateX(-100%)" : "translateX(0)", transition: "transform 1.4s cubic-bezier(.6,0,.2,1)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%", background: "linear-gradient(270deg,#1d140b,#0d0906)", borderLeft: "3px solid #0b0f15", boxShadow: "inset 30px 0 60px rgba(0,0,0,.6)", transform: open ? "translateX(100%)" : "translateX(0)", transition: "transform 1.4s cubic-bezier(.6,0,.2,1)" }} />
      {/* warm spill */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(46% 34% at 50% 52%, ${room.accent}44, transparent 72%)`, opacity: open ? 1 : 0, transition: "opacity 1s" }} />

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

      {/* THAT boss's standing avatar slides up in front of the doorway */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={room.avatarImg}
        alt={`${room.boss} standing`}
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%)",
          height: "82%",
          maxWidth: "92%",
          objectFit: "contain",
          filter: `drop-shadow(0 0 40px ${room.accent}66)`,
          animation: open ? "foxpitAvatarUp 1.4s cubic-bezier(.2,.8,.2,1) .2s both" : "none",
        }}
      />

      {prompt && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 46, textAlign: "center", animation: "foxpitFadeUp .6s ease both" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#f5ead0", textShadow: "0 2px 20px #000" }}>
            {room.boss} welcomes you
          </div>
          <button onClick={onEnter} style={{ marginTop: 16, border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "14px 26px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
            Enter {room.name} ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- table panel ---------------- */
function TablePanel({
  room, index, freeKeycard, onClose, onSeat,
}: {
  room: ReturnType<typeof roomByKey>;
  index: number;
  freeKeycard: boolean;
  onClose: () => void;
  onSeat: () => void;
}) {
  const cats = ["Politics", "Crypto", "Weather"];
  const cat = cats[index % cats.length]!;
  const cost = [500, 1000, 2000][index % 3]!;
  const diff = ["Rookie", "Contender", "Sharp"][index % 3]!;
  const prize = cost * 8;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 66, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(3,4,7,.55)", padding: 18 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, borderRadius: 18, background: "linear-gradient(180deg,#141821,#0a0d13)", border: `2px solid ${room.accent}`, boxShadow: `0 0 40px ${room.accent}44`, padding: 22, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#E7E7EB" }}>Table {index + 1} · {cat}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b98a6", fontSize: 24, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "16px 0" }}>
          <Stat label="Entry" value={`${cost} coins`} />
          <Stat label="Difficulty" value={diff} />
          <Stat label="Prize" value={`${prize} coins`} />
        </div>
        {freeKeycard && (
          <div style={{ borderRadius: 12, border: "1px dashed #FC3E01", background: "rgba(252,62,1,.10)", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MEMBERSHIP_CARD} alt="Membership keycard" style={{ width: 76, height: "auto", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.55)" }} />
            <div>
              <div style={{ color: "#ffb089", fontWeight: 800, fontSize: 14, letterSpacing: ".04em" }}>FREE-ENTRY KEYCARD</div>
              <div style={{ color: "#c3cedb", fontSize: 12 }}>First round&apos;s on the house.</div>
            </div>
          </div>
        )}
        <button onClick={onSeat} style={{ width: "100%", border: `1px solid ${room.accent}`, background: `${room.accent}22`, color: "#ffe", borderRadius: 12, padding: "16px", fontSize: 18, fontWeight: 800, cursor: "pointer" }}>
          Take your seat ›
        </button>
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid #22303c", padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: ".12em", color: "#8b98a6", fontWeight: 700 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 14, color: "#E7E7EB", fontWeight: 800, marginTop: 3 }}>{value}</div>
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
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 42, textAlign: "center" }}>
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
  top: 18,
  left: 18,
  zIndex: 65,
  border: "1px solid rgba(200,162,75,.5)",
  background: "rgba(3,4,7,.6)",
  color: "#d8c79b",
  borderRadius: 12,
  padding: "12px 18px",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};
