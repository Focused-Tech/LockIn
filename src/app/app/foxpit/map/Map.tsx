"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockGlyph } from "@/components/practice/LockGlyph";
import {
  FOXPIT_ROOMS,
  LOBBY_MAP_Y,
  KEY_ASSET,
  MEMBERSHIP_CARD,
  ELEVATOR_UNLOCK_AT,
  WINNERS_LOUNGE,
  winnersUnlocked,
  getCleared,
  isUnlocked,
  keyLabel,
  roomByKey,
  type FoxPitRoom,
  type FoxPitRoomKey,
} from "@/lib/foxpit";
import { ELEVATOR_BOTTOM_STOP_PCT } from "@/lib/foxpit/rules";
import { StairClimber, FrontRails } from "./StairClimber";

/**
 * Fox Pit TOWER MAP (build map = map/tower_map_clean.png 1620x4500, natural aspect;
 * night sky + baked staircase overlaid as their own layers) — a tall vertical climb with
 * pinch-to-zoom + pan. Floors are slim PLAQUES (the painted room art shows
 * behind them). The header appears on entry and fades out after 4s. The
 * elevator (far left) opens a FLOOR-SELECT panel: the four room cards, each
 * CLEARED or LOCKED, plus the tiered keys you've won.
 */
const pinchDist = (t: React.TouchList) => {
  const a = t[0]!;
  const b = t[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

export function FoxPitMap({ lone = false }: { lone?: boolean }) {
  const router = useRouter();
  const vpRef = useRef<HTMLDivElement>(null);
  const cRef = useRef<HTMLDivElement>(null);
  const towerRef = useRef<HTMLDivElement>(null);
  const [cleared, setCleared] = useState<Set<FoxPitRoomKey>>(new Set());
  const [hud, setHud] = useState(true);
  const [elevatorLocked, setElevatorLocked] = useState(false);
  const [elevatorRide, setElevatorRide] = useState(false);
  // Fast-travel elevator activates only once the High Table is CLEARED (beaten),
  // independent of the architect door-unlock override.
  const elevatorUnlocked = cleared.has(ELEVATOR_UNLOCK_AT);

  // pan/zoom (kept in a ref + applied directly to the DOM — no re-render churn)
  const v = useRef({ scale: 1, tx: 0, ty: 0 });
  const g = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    lx: 0,
    ly: 0,
    d0: 0,
    s0: 1,
  });

  const apply = () => {
    const c = cRef.current;
    if (c)
      c.style.transform = `translate3d(${v.current.tx}px, ${v.current.ty}px, 0) scale(${v.current.scale})`;
  };
  const clamp = () => {
    const vp = vpRef.current;
    const c = cRef.current;
    if (!vp || !c) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const cw = c.offsetWidth * v.current.scale;
    const ch = c.offsetHeight * v.current.scale;
    v.current.tx = Math.max(Math.min(0, vw - cw), Math.min(0, v.current.tx));
    v.current.ty = Math.max(Math.min(0, vh - ch), Math.min(0, v.current.ty));
  };

  // FIXED VERTICAL SCALE (not fit-to-width). The stairs plate is only 1:2, so a
  // fit-width render is shorter than a tall phone (nothing scrolls) and the rooms
  // read small. Instead the map fills the width AND is stretched to a fixed tall
  // height (TOWER_H below) so every room band gets a readable pixel height and the
  // total exceeds the viewport → the vertical climb scrolls. No zoom transform, no
  // horizontal pan — pure vertical scroll; pinch can still zoom in on a room.
  const fitTower = () => {
    const vp = vpRef.current;
    const c = cRef.current;
    const tw = towerRef.current;
    if (!vp || !c) return;
    v.current.scale = 1;
    v.current.tx = 0;
    const minTy = Math.min(0, vp.clientHeight - c.offsetHeight);
    // Open centered on the player's CURRENT floor (the first not-yet-cleared room
    // in climb order) rather than dumping them at the bottom/lobby.
    const cl = getCleared();
    const current = FOXPIT_ROOMS.find((r) => !cl.has(r.key)) ?? FOXPIT_ROOMS[0];
    if (tw && current) {
      const roomY = tw.offsetTop + current.mapY * tw.offsetHeight; // content-space y
      v.current.ty = Math.max(minTy, Math.min(0, vp.clientHeight / 2 - roomY));
    } else {
      v.current.ty = minTy; // fallback: the bottom (the Dojo)
    }
    apply();
  };

  useEffect(() => {
    setCleared(getCleared());
    // fit + start at the bottom (the Dojo) — you climb up
    requestAnimationFrame(fitTower);
    const t = window.setTimeout(() => setHud(false), 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length === 1) {
      g.current = { mode: "pan", lx: t[0]!.clientX, ly: t[0]!.clientY, d0: 0, s0: v.current.scale };
    } else if (t.length === 2) {
      const mx = (t[0]!.clientX + t[1]!.clientX) / 2;
      const my = (t[0]!.clientY + t[1]!.clientY) / 2;
      g.current = { mode: "pinch", lx: mx, ly: my, d0: pinchDist(t), s0: v.current.scale };
    }
  };
  const onMove = (e: React.TouchEvent) => {
    const t = e.touches;
    if (g.current.mode === "pan" && t.length === 1) {
      v.current.tx += t[0]!.clientX - g.current.lx;
      v.current.ty += t[0]!.clientY - g.current.ly;
      g.current.lx = t[0]!.clientX;
      g.current.ly = t[0]!.clientY;
      clamp();
      apply();
    } else if (g.current.mode === "pinch" && t.length === 2 && g.current.d0 > 0) {
      const ns = Math.max(1, Math.min(3, g.current.s0 * (pinchDist(t) / g.current.d0)));
      const mx = (t[0]!.clientX + t[1]!.clientX) / 2;
      const my = (t[0]!.clientY + t[1]!.clientY) / 2;
      const rect = vpRef.current!.getBoundingClientRect();
      const px = mx - rect.left;
      const py = my - rect.top;
      const k = ns / v.current.scale;
      v.current.tx = px - (px - v.current.tx) * k;
      v.current.ty = py - (py - v.current.ty) * k;
      v.current.scale = ns;
      clamp();
      apply();
    }
  };
  const onEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) g.current.mode = "none";
    else if (e.touches.length === 1) {
      g.current.mode = "pan";
      g.current.lx = e.touches[0]!.clientX;
      g.current.ly = e.touches[0]!.clientY;
    }
  };

  const enter = (key: FoxPitRoomKey) => router.push(`/app/foxpit/room/${key}`);

  // Membership card → "walk down the stairs" to the Dojo (free practice at the
  // bottom): smoothly pan the tower down to the very bottom.
  const walkDownToPractice = () => {
    const vp = vpRef.current;
    const c = cRef.current;
    if (!vp || !c) return;
    c.style.transition = "transform 1.8s cubic-bezier(.45,.05,.2,1)";
    v.current.tx = (vp.clientWidth - c.offsetWidth * v.current.scale) / 2;
    v.current.ty = vp.clientHeight - c.offsetHeight * v.current.scale;
    apply();
    window.setTimeout(() => {
      if (cRef.current) cRef.current.style.transition = "";
    }, 1900);
  };

  return (
    <div
      ref={vpRef}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#0A0D12",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <div
        ref={cRef}
        style={{ position: "relative", width: "100%", transformOrigin: "0 0", willChange: "transform" }}
      >
        {/* TOP MATTE — pushes the Suite (top room) down clear of the ‹ Lobby button. */}
        <div style={{ height: "18vw", background: "#0A0D12" }} />
        {/* TOWER WRAP — the image + every absolute overlay live in here so their
            top:% stays relative to the image, not the matte-padded outer container. */}
        <div ref={towerRef} style={{ position: "relative", width: "100%" }}>
        {/* NIGHT SKY — a SEPARATE, swappable layer (not baked into the map bitmap) that
            continues the skyline painted inside the Winner's Lounge windows up over the
            empty top of the map, so rooftop + room read as one continuous night. Sits
            BEHIND the map (zIndex 0); the map's painted top overlaps it. Swap <NightSky>
            for a day variant later. */}
        <NightSky />

        {/* BUILD MAP — tower_map_clean.png (1620x4500), natural aspect (no distort). The
            elevator stops + every overlay are % of THIS image's height. relative/z1 so
            it paints over the night sky where the art is opaque. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/map/tower_map_clean.png"
          alt="The Fox Pit tower"
          draggable={false}
          onLoad={fitTower}
          style={{ position: "relative", zIndex: 1, width: "100%", height: "auto", display: "block" }}
        />

        {/* STAIRCASE — ONE baked piece (tower_staircase_clean.png, 1620x4500, transparent),
            back railings already baked in. Overlaid 1:1 on the map (same dimensions). The
            loose newel/rail pieces (public/foxpit/map/stair_pieces/) form the walk-through
            slot IN FRONT of a walking avatar — that sandwich lands with the avatar-walk
            feature; here the baked piece is the tower's staircase. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/map/tower_staircase_clean.png"
          alt=""
          aria-hidden
          draggable={false}
          style={{ position: "absolute", zIndex: 1, top: 0, left: 0, width: "100%", height: "auto", display: "block", pointerEvents: "none" }}
        />

        {/* AVATAR CLIMB (Phase A) — the player walks the switchback stairs. Layer order:
            map + baked back rail (staircase_clean) → AVATAR (z5) → FRONT-RAIL overlay (z6),
            so at a landing he walks THROUGH the open front edge (the slot). Waypoints are
            first-pass; the ⚙ calibrate tool dumps corrected numbers. */}
        <StairClimber />
        <FrontRails />

        {/* floor plaques — slim, so the painted room art shows behind them */}
        {FOXPIT_ROOMS.map((r) => {
          const unlocked = lone || isUnlocked(r, cleared);
          const done = cleared.has(r.key);
          const current = unlocked && !done;
          return (
            <button
              key={r.key}
              onClick={() => unlocked && enter(r.key)}
              disabled={!unlocked}
              style={{
                position: "absolute",
                zIndex: 2,
                top: `${r.mapY * 100}%`,
                left: "14%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: "74%",
                padding: "7px 12px",
                borderRadius: 999,
                textAlign: "left",
                cursor: unlocked ? "pointer" : "not-allowed",
                color: "#E7E7EB",
                background: current
                  ? "rgba(20,10,4,.78)"
                  : unlocked
                    ? "rgba(10,13,18,.66)"
                    : "rgba(3,4,7,.7)",
                border: `1.5px solid ${current ? "#FC3E01" : unlocked ? r.accent : "#3a4653"}`,
                boxShadow: current ? "0 0 22px rgba(252,62,1,.5)" : "0 6px 16px rgba(0,0,0,.5)",
                filter: unlocked ? "none" : "grayscale(.5) brightness(.72)",
                animation: current ? "foxpitGlow 2.6s ease-in-out infinite" : "none",
                backdropFilter: "blur(1px)",
              }}
            >
              {!unlocked ? (
                <LockGlyph size={14} />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1,
                    color: done ? "#22C55E" : current ? "#FC3E01" : r.accent,
                  }}
                >
                  {done ? "✓" : current ? "▸" : "•"}
                </span>
              )}
              <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, letterSpacing: ".03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.name}
              </span>
              {!unlocked && (
                <span style={{ fontSize: 10, color: "#c8a24b", fontWeight: 800, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
                  {keyLabel(r.needsKey!)} KEY
                </span>
              )}
            </button>
          );
        })}

        {/* WINNER'S LOUNGE plaque — the rooftop reward floor (STOP_1). HIDDEN entirely
            (not dimmed) until Boss Fox is beaten; then it appears in the directory. It is
            PvP, not a boss room, so it has no key/lock row — it's a destination, not a
            grind. Interior build is a separate task. */}
        {winnersUnlocked(cleared) && (
          <div
            style={{
              position: "absolute",
              zIndex: 2,
              top: `${WINNERS_LOUNGE.mapY * 100}%`,
              left: "14%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: "74%",
              padding: "7px 12px",
              borderRadius: 999,
              color: "#1a140a",
              background: "rgba(245,197,66,.9)",
              border: `1.5px solid ${WINNERS_LOUNGE.accent}`,
              boxShadow: "0 0 22px rgba(245,197,66,.5)",
              backdropFilter: "blur(1px)",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>✦</span>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 800, letterSpacing: ".03em", whiteSpace: "nowrap" }}>
              {WINNERS_LOUNGE.name}
            </span>
            <span style={{ fontSize: 10, color: "#5a4408", fontWeight: 800, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
              PvP
            </span>
          </div>
        )}

        {/* lobby landmark (street level, a hub — tap to return to the lobby) */}
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{
            position: "absolute",
            zIndex: 2,
            top: `${LOBBY_MAP_Y * 100}%`,
            left: "14%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            cursor: "pointer",
            color: "#d8c79b",
            background: "rgba(10,13,18,.6)",
            border: "1.5px solid rgba(200,162,75,.45)",
          }}
        >
          <span style={{ fontSize: 12 }}>⌂</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 700, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
            Lobby
          </span>
        </button>

        {/* Practice Here — glued to the LOBBY landing at the end of the staircase
            (rides with the tower so it never drifts off its floor). */}
        <button
          onClick={walkDownToPractice}
          aria-label="Practice free at the Dojo"
          style={{
            position: "absolute",
            zIndex: 2,
            top: `${LOBBY_MAP_Y * 100 + 7}%`,
            left: "14%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {/* just the membership card (bounces) + a down arrow (flashes) — every 7s */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MEMBERSHIP_CARD} alt="Practice" style={{ width: 56, height: "auto", borderRadius: 5, boxShadow: "0 3px 10px rgba(0,0,0,.7)", animation: "foxpitPracticeBounce 7s ease-in-out infinite" }} />
          <span style={{ fontSize: 20, fontWeight: 900, color: "#ffb089", lineHeight: 1, textShadow: "0 2px 6px #000, 0 0 8px #000", animation: "foxpitArrowFlash 7s ease-in-out infinite" }}>↓</span>
        </button>

        {/* SHAFT tap zone — the entire elevator column is tappable so the floor
            picker opens even while the car is mid-travel (you never have to land a
            tap on the moving car). */}
        <button
          onClick={() => (elevatorUnlocked ? setElevatorRide(true) : setElevatorLocked(true))}
          aria-label="Use the elevator"
          style={{ position: "absolute", zIndex: 3, top: 0, bottom: 0, left: 0, width: "12%", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
        />

        {/* elevator CABLE — a taut BRASS cable running the shaft; the car rides it.
            Centered on the car (car left 0.5% + half its 8% width ≈ 4.5%). The
            gradient reads as a round cord: dark brass edges, lit gold core. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            zIndex: 0,
            top: 0,
            bottom: 0,
            left: "4.5%",
            width: 3,
            transform: "translateX(-50%)",
            background: "linear-gradient(90deg, rgba(90,64,18,.15), rgba(200,162,75,.95) 45%, rgba(245,224,160,1) 55%, rgba(90,64,18,.15))",
            boxShadow: "0 0 6px rgba(200,162,75,.45), 0 0 3px rgba(0,0,0,.6)",
            pointerEvents: "none",
          }}
        />

        {/* elevator CAR — Frank's canonical asset (elevator_car.png, same car as the
            door frames). Travels the shaft band; tap to call the floor-select.
            The car's BOTTOM rests on each landing (translateY(-100%) anchors bottom
            to the top:% line). Locked until the High Table is cleared (parked + dimmed). */}
        <button
          onClick={() => (elevatorUnlocked ? setElevatorRide(true) : setElevatorLocked(true))}
          aria-label="Elevator"
          style={{
            position: "absolute",
            zIndex: 1,
            // Idle rest = STOP_7 (Dojo, bottom of shaft). 'top' is the car's BOTTOM edge
            // (translateY(-100%) anchors bottom to the top:% line), so it equals the stop
            // pct directly. When unlocked, foxpitElevatorStops drives the full-height climb.
            top: `${ELEVATOR_BOTTOM_STOP_PCT}%`,
            left: "0.5%",
            width: "8%",
            transform: "translateY(-100%)",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            filter: elevatorUnlocked ? "none" : "grayscale(.55) brightness(.6)",
            animation: elevatorUnlocked
              ? "foxpitElevatorStops 34s ease-in-out infinite"
              : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/foxpit/elevator/elevator_car.png"
            alt="Elevator"
            draggable={false}
            style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.6))" }}
          />
        </button>
        </div>{/* /TOWER WRAP */}
        {/* BOTTOM MATTE — lifts the Dojo + the full elevator car clear of the nav bar. */}
        <div style={{ height: "20vw", background: "#0A0D12" }} />
      </div>

      {/* SAFE-AREA masks — the stretched full-bleed tower runs edge-to-edge (the old
          map art had baked dark padding that the trim removed). These opaque strips
          reclaim the Android status-bar (top) + nav (bottom) zones so no room bleeds
          under the system bars, and give the top/bottom rooms breathing room. */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "calc(env(safe-area-inset-top, 0px) + 10px)", background: "#0A0D12", zIndex: 62, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "calc(env(safe-area-inset-bottom, 0px) + 12px)", background: "#0A0D12", zIndex: 62, pointerEvents: "none" }} />

      {/* fixed HUD — appears on entry, fades out after 4s */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 110,
          zIndex: 61,
          pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(3,4,7,.92),transparent)",
          opacity: hud ? 1 : 0,
          transition: "opacity 1.1s ease",
        }}
      >
        <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".12em", color: "#E7E7EB" }}>
            {lone ? "CHOOSE AN ARENA" : "THE BOSS JOURNEY"}
          </div>
          <div style={{ fontSize: 12, letterSpacing: ".2em", color: "#C8A24B", fontWeight: 700, marginTop: 2 }}>
            CLIMB THE TOWER
          </div>
        </div>
      </div>

      {/* always-available Lobby button (outside the fading HUD) */}
      <button
        onClick={() => router.push("/app/foxpit")}
        style={{
          position: "fixed",
          top: 16,
          left: 8,
          zIndex: 63,
          border: "1px solid rgba(200,162,75,.5)",
          background: "rgba(3,4,7,.62)",
          color: "#d8c79b",
          borderRadius: 10,
          padding: "8px 11px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ‹ Lobby
      </button>

      {elevatorRide && (
        <ElevatorRide
          lone={lone}
          cleared={cleared}
          onClose={() => setElevatorRide(false)}
          onArrive={(k) => { setElevatorRide(false); enter(k); }}
        />
      )}

      {elevatorLocked && (
        <div
          onClick={() => setElevatorLocked(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(3,4,7,.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 360,
              borderRadius: 16,
              background: "linear-gradient(180deg,#141821,#0a0d13)",
              border: "2px solid #C8A24B",
              boxShadow: "0 0 40px rgba(200,162,75,.35)",
              padding: 26,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <LockGlyph size={44} />
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#E7E7EB", marginTop: 8 }}>
              Elevator locked
            </div>
            <div style={{ width: 90, height: 2, margin: "12px auto", background: "linear-gradient(90deg,transparent,#C8A24B,transparent)" }} />
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#c3cedb" }}>
              The elevator stays out of service until you reach the{" "}
              <b style={{ color: "#C8A24B" }}>{roomByKey(ELEVATOR_UNLOCK_AT).name}</b>. Climb the
              tower and clear the floors below to unlock fast-travel between them.
            </p>
            <button
              onClick={() => setElevatorLocked(false)}
              style={{
                marginTop: 22,
                border: "1px solid #C8A24B",
                background: "rgba(200,162,75,.15)",
                color: "#ffe",
                borderRadius: 12,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * NIGHT SKY — the rooftop backdrop as its OWN swappable layer (never baked into the
 * map bitmap). It continues the city-at-night painted inside the Winner's Lounge
 * windows up across the empty top of the map, so the rooftop and the room read as one
 * continuous night. Swap this whole component for a <DaySky> later. Colours are named
 * locals (zenith → city-glow horizon) so no bare hex drives the layout intent.
 */
function NightSky() {
  const NIGHT_ZENITH = "#04060c"; // darkest, straight up
  const NIGHT_SKY = "#0b1322"; // the body of the sky
  const CITY_GLOW = "#1b2942"; // haze just above the distant skyline (matches the window art)
  // Fixed star positions (no Math.random — stable across SSR/hydration).
  const stars = [
    [12, 18], [24, 40], [33, 12], [46, 28], [58, 8], [67, 34],
    [74, 20], [82, 46], [88, 14], [19, 55], [52, 52], [71, 60],
  ];
  return (
    <div
      aria-hidden
      style={{ position: "absolute", zIndex: 0, top: 0, left: 0, right: 0, height: "30%", pointerEvents: "none", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${NIGHT_ZENITH} 0%, ${NIGHT_SKY} 60%, ${CITY_GLOW} 100%)`,
        }}
      />
      {stars.map(([x, y], i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: i % 3 === 0 ? 2.5 : 1.5,
            height: i % 3 === 0 ? 2.5 : 1.5,
            borderRadius: "50%",
            background: "#dfe7f5",
            opacity: i % 2 === 0 ? 0.85 : 0.5,
            boxShadow: "0 0 3px rgba(223,231,245,.7)",
          }}
        />
      ))}
    </div>
  );
}

/** Door-open frame sequence (closed → open); reversed to close. */
const ELEVATOR_FRAMES = [
  "/foxpit/elevator/door-closed.png",
  "/foxpit/elevator/door-mid1.png",
  "/foxpit/elevator/door-mid2.png",
  "/foxpit/elevator/door-open.png",
];

// ── Elevator-interior design tokens (named — no bare hex drives the layout) ──
// The felt reds are sampled from the shaft felt in tower_map_clean.png (~#2a160d) and
// lifted so the car's BACK WALL reads as red felt, not a black void. Brass matches the car.
const FELT_BASE = "#3a1712";
const FELT_DEEP = "#1b0c09";
const FELT_LIT = "#57231b";
const BRASS = "#c8a24b";
const BRASS_LIT = "#f0d68a";
const BRASS_DARK = "#6e5320";
const INK = "#211505"; // engraving on a lit brass button
const LABEL_MUTED = "#7d7365";

/** Tiled red-felt back wall for the car interior, built from the felt tokens. */
const FELT_WALL: React.CSSProperties = {
  backgroundColor: FELT_BASE,
  backgroundImage: [
    `radial-gradient(circle at 28% 18%, ${FELT_LIT} 0%, rgba(0,0,0,0) 44%)`,
    `radial-gradient(circle at 76% 84%, ${FELT_LIT} 0%, rgba(0,0,0,0) 50%)`,
    `repeating-linear-gradient(45deg, ${FELT_DEEP} 0 2px, rgba(0,0,0,0) 2px 5px)`,
    `repeating-linear-gradient(-45deg, rgba(0,0,0,.16) 0 2px, rgba(0,0,0,0) 2px 5px)`,
    `linear-gradient(180deg, ${FELT_LIT} 0%, ${FELT_BASE} 46%, ${FELT_DEEP} 100%)`,
  ].join(","),
};

/** One row in the elevator directory: a boss room, the lobby hub, or the rooftop lounge. */
type FloorDest =
  | { kind: "room"; room: FoxPitRoom }
  | { kind: "lobby" }
  | { kind: "winners" };

/**
 * ELEVATOR RIDE — tap the car → the ornate doors slide OPEN → HARD CUT to a full-screen
 * car INTERIOR: red-felt back wall, a brass up/down call plate on the side wall, and a
 * floor DIRECTORY (round call buttons; lit when unlocked, dim + tier-key when locked).
 * Pick a floor → doors CLOSE → the car travels → arrive. The Winner's Lounge (rooftop
 * PvP) only lists once Boss Fox is beaten; arriving there plays a Boss-Fox welcome beat
 * (usher art is a placeholder — swap when delivered).
 */
function ElevatorRide({
  lone,
  cleared,
  onClose,
  onArrive,
}: {
  lone: boolean;
  cleared: Set<FoxPitRoomKey>;
  onClose: () => void;
  onArrive: (k: FoxPitRoomKey) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"opening" | "select" | "closing" | "riding" | "lounge">("opening");
  const [frame, setFrame] = useState(0);
  const [dest, setDest] = useState<FloorDest | null>(null);

  // Directory, top → bottom. Winner's Lounge only appears once Boss Fox is beaten.
  const directory: FloorDest[] = [
    ...(winnersUnlocked(cleared) ? [{ kind: "winners" } as FloorDest] : []),
    { kind: "room", room: roomByKey("suite") },
    { kind: "room", room: roomByKey("hightable") },
    { kind: "room", room: roomByKey("coliseum") },
    { kind: "lobby" },
    { kind: "room", room: roomByKey("dojo") },
  ];

  const destName = (d: FloorDest) =>
    d.kind === "room" ? d.room.name : d.kind === "lobby" ? "Lobby" : WINNERS_LOUNGE.name;

  // doors open: 0 → last, then HARD CUT to the interior floor-select
  useEffect(() => {
    if (phase !== "opening") return;
    if (frame < ELEVATOR_FRAMES.length - 1) {
      const t = setTimeout(() => setFrame((f) => f + 1), 240);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("select"), 300);
    return () => clearTimeout(t);
  }, [phase, frame]);

  // doors close: last → 0, then travel
  useEffect(() => {
    if (phase !== "closing") return;
    if (frame > 0) {
      const t = setTimeout(() => setFrame((f) => f - 1), 200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("riding"), 250);
    return () => clearTimeout(t);
  }, [phase, frame]);

  // travel, then arrive (rooms → onArrive; lobby → hub; winners → welcome beat)
  useEffect(() => {
    if (phase !== "riding" || !dest) return;
    const t = setTimeout(() => {
      if (dest.kind === "room") onArrive(dest.room.key);
      else if (dest.kind === "lobby") router.push("/app/foxpit");
      else setPhase("lounge");
    }, 1700);
    return () => clearTimeout(t);
  }, [phase, dest, onArrive, router]);

  const pick = (d: FloorDest) => { setDest(d); setFrame(ELEVATOR_FRAMES.length - 1); setPhase("closing"); };
  const showDoors = phase === "opening" || phase === "closing";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 85, ...FELT_WALL, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* interior vignette so the felt reads with depth */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: `inset 0 0 120px 30px ${FELT_DEEP}` }} />

      {/* DOORS — the ornate car doors: opening on entry, closing on pick. Centered as the
          portal in front of the felt; hard-cut away once open. */}
      {showDoors && (
        <div style={{ position: "absolute", inset: 0, background: "#05070b", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4 }}>
          <div style={{ position: "relative", height: "92%", aspectRatio: "1 / 1", maxWidth: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ELEVATOR_FRAMES[frame]} alt="Elevator doors" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 44px rgba(200,162,75,.22))" }} />
          </div>
        </div>
      )}

      {/* INTERIOR — floor directory + side call-plate (select), and the travel beat (riding) */}
      {(phase === "select" || phase === "riding") && (
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", padding: "calc(env(safe-area-inset-top,0px) + 16px) calc(env(safe-area-inset-right,0px) + 14px) calc(env(safe-area-inset-bottom,0px) + 16px) calc(env(safe-area-inset-left,0px) + 14px)" }}>
          {/* header */}
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: ".14em", color: BRASS_LIT, textShadow: "0 2px 6px #000" }}>ELEVATOR</div>
              <div style={{ fontSize: 10, letterSpacing: ".24em", color: BRASS, fontWeight: 800 }}>SELECT A FLOOR</div>
            </div>
            {phase === "select" && (
              <button onClick={onClose} aria-label="Close" style={{ border: `1px solid ${BRASS}`, background: "rgba(0,0,0,.35)", color: BRASS_LIT, borderRadius: 10, padding: "6px 12px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>✕</button>
            )}
          </div>

          {/* body: side call-plate + the directory */}
          <div style={{ flex: "1 1 auto", display: "flex", gap: 12, marginTop: 14, minHeight: 0 }}>
            {/* SIDE WALL up/down call plate — brass, matches the car */}
            <div style={{ flex: "0 0 auto", alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 8px", borderRadius: 12, background: `linear-gradient(180deg, ${BRASS}, ${BRASS_DARK})`, border: `2px solid ${BRASS_LIT}`, boxShadow: `0 6px 16px rgba(0,0,0,.5), inset 0 0 8px ${BRASS_LIT}` }}>
              {(["▲", "▼"] as const).map((g, i) => {
                const lit = phase === "riding" && i === 0;
                return (
                  <span key={g} style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 13, color: INK, background: `radial-gradient(circle at 40% 35%, ${BRASS_LIT}, ${BRASS_DARK})`, border: `1.5px solid ${BRASS_LIT}`, boxShadow: lit ? `0 0 12px ${BRASS_LIT}` : "inset 0 1px 3px rgba(0,0,0,.5)", opacity: lit ? 1 : 0.85 }}>{g}</span>
                );
              })}
              <div style={{ width: 34, height: 12, borderRadius: 3, background: "#0c0904", color: BRASS_LIT, fontSize: 8, fontWeight: 800, display: "grid", placeItems: "center", letterSpacing: ".06em" }}>{dest ? "•••" : "—"}</div>
            </div>

            {/* DIRECTORY — one row per floor */}
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", minHeight: 0, animation: "foxpitFadeUp .4s ease both" }}>
              {directory.map((d) => (
                <FloorRow key={d.kind === "room" ? d.room.key : d.kind} d={d} lone={lone} cleared={cleared} traveling={phase === "riding"} onPick={pick} />
              ))}
            </div>
          </div>

          {phase === "riding" && dest && (
            <div style={{ flex: "0 0 auto", textAlign: "center", marginTop: 10 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: BRASS_LIT, letterSpacing: ".1em", textShadow: "0 2px 12px #000" }}>
                Traveling to {destName(dest)}…
              </div>
            </div>
          )}
        </div>
      )}

      {/* WINNER'S LOUNGE welcome beat — Boss Fox ushers the player in (placeholder cutout). */}
      {phase === "lounge" && (
        <div style={{ position: "relative", zIndex: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px", animation: "foxpitFadeUp .5s ease both" }}>
          <div style={{ fontSize: 11, letterSpacing: ".26em", color: BRASS, fontWeight: 800 }}>WINNER&apos;S LOUNGE</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={roomByKey("suite").avatarImg} alt="Boss Fox welcomes you" draggable={false} style={{ height: "46%", width: "auto", maxWidth: "80%", objectFit: "contain", margin: "14px 0", filter: "drop-shadow(0 10px 30px rgba(0,0,0,.7))" }} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#f5e3ac" }}>Boss Fox welcomes you in</div>
          <div style={{ fontSize: 13, color: "#e8cfa0", marginTop: 6, maxWidth: 320, lineHeight: 1.5 }}>
            You beat the tower. This is the rooftop — player versus player. (Lounge opening soon.)
          </div>
          <button onClick={onClose} style={{ marginTop: 22, border: `2px solid ${BRASS}`, background: "rgba(200,162,75,.16)", color: "#fff", borderRadius: 12, padding: "12px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Step in ›</button>
        </div>
      )}
    </div>
  );
}

/** One directory row: a round brass call button + floor label; lit when unlocked, dim
 *  with the tier-key icon when locked. */
function FloorRow({
  d,
  lone,
  cleared,
  traveling,
  onPick,
}: {
  d: FloorDest;
  lone: boolean;
  cleared: Set<FoxPitRoomKey>;
  traveling: boolean;
  onPick: (d: FloorDest) => void;
}) {
  const room = d.kind === "room" ? d.room : null;
  const unlocked = d.kind === "room" ? lone || isUnlocked(room!, cleared) : true;
  const done = room ? cleared.has(room.key) : false;
  const name = d.kind === "winners" ? WINNERS_LOUNGE.name : d.kind === "lobby" ? "Lobby" : room!.name;
  const sub = d.kind === "winners" ? WINNERS_LOUNGE.floorLabel : d.kind === "lobby" ? "Street level · Hub" : room!.floorLabel;
  const accent = d.kind === "winners" ? WINNERS_LOUNGE.accent : d.kind === "lobby" ? BRASS : room!.accent;
  const keyIcon = !unlocked && room?.needsKey ? KEY_ASSET[room.needsKey] : null;

  return (
    <button
      onClick={() => unlocked && !traveling && onPick(d)}
      disabled={!unlocked || traveling}
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 14,
        background: "rgba(10,5,4,.55)",
        border: `1.5px solid ${unlocked ? accent : BRASS_DARK}`,
        boxShadow: unlocked ? `0 0 14px ${accent}44` : "none",
        cursor: unlocked && !traveling ? "pointer" : "not-allowed",
        filter: unlocked ? "none" : "grayscale(.35) brightness(.82)",
      }}
    >
      {/* round CALL BUTTON — glowing brass when unlocked, dim when locked */}
      <span style={{
        flex: "0 0 auto", width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center",
        fontSize: 17, fontWeight: 900, color: unlocked ? INK : BRASS_DARK,
        background: unlocked ? `radial-gradient(circle at 38% 32%, ${BRASS_LIT}, ${BRASS_DARK})` : "radial-gradient(circle at 38% 32%, #241a10, #0d0a06)",
        border: `2px solid ${unlocked ? BRASS_LIT : BRASS_DARK}`,
        boxShadow: unlocked ? `0 0 14px ${BRASS}aa, inset 0 0 6px ${BRASS_LIT}` : "inset 0 2px 5px rgba(0,0,0,.6)",
      }}>
        {done ? "✓" : unlocked ? "●" : <LockGlyph size={16} />}
      </span>

      {/* label */}
      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, color: unlocked ? "#f6ead2" : LABEL_MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        <span style={{ display: "block", fontSize: 10, letterSpacing: ".08em", fontWeight: 700, color: unlocked ? accent : LABEL_MUTED }}>{sub.toUpperCase()}</span>
      </span>

      {/* right: tier-key when locked, CLEARED when done */}
      {keyIcon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={keyIcon.src} alt={`needs ${keyIcon.tier} key`} style={{ flex: "0 0 auto", height: 30, width: "auto", filter: "drop-shadow(0 2px 5px #000)" }} />
      ) : done ? (
        <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#22C55E" }}>CLEARED</span>
      ) : null}
    </button>
  );
}
