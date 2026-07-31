"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockGlyph } from "@/components/practice/LockGlyph";
import { WinnersLoungeLocker } from "../WinnersLoungeLocker";
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
import { ELEVATOR_STOP_BY_ID } from "@/lib/foxpit/rules";
import { StairClimber } from "./StairClimber";
import { ArenaIntro } from "@/app/app/practice/arena/chooser/ArenaIntro";

/**
 * Fox Pit TOWER MAP (a stack of full-canvas 1620x4500 plates from map/tower_layers, composited at
 * offset 0,0: z0 map_REDO < z10 stairway < z20 elevator_band < z50 avatar < z60 front rail) — a
 * tall vertical climb with
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
  // The BUILD MAP is a large image; hold the tower (elevator animation + overlays) behind a loader
  // until it has fully decoded, so the map shows FIRST and complete — not in sections after the car.
  const [elevatorLocked, setElevatorLocked] = useState(false);
  const [elevatorRide, setElevatorRide] = useState(false);
  // Enter the Winner's Lounge straight from its map plaque (like every other room), not only via
  // the elevator — plays the same entrance cinematic.
  const [loungeArrival, setLoungeArrival] = useState(false);
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
            empty top of the map, so rooftop + room read as one continuous night. Sits ABOVE
            the map (zIndex 2) over the top exterior band, covering the map's baked direction
            labels with sky. Swap <NightSky> for a day variant later. */}
        <NightSky />

        {/* TOWER SANDWICH — two full-canvas plates (1620x4500) authored ALIGNED by the architect, both
            composited at offset (0,0), no scale/placement. z0 BASE (map + stair BACKS, sizes the
            container) → z50 AVATAR → z60 stair OVERLAY (front rails). The avatar walks BETWEEN the
            plates: IN THE SLOT. Stairs are baked at their reference positions, so the avatar path is
            unchanged. Source: NEW_MAP_TOWER_SANDWICH (_layer_index.json). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/map/tower_layers/tower_base.webp"
          alt="The Fox Pit tower"
          draggable={false}
          onLoad={() => { fitTower(); }}
          style={{ position: "relative", zIndex: 0, width: "100%", height: "auto", display: "block" }}
        />

        {/* AVATAR (live rig) — StairClimber renders it at z50, BETWEEN the base (z0) and the stair
            overlay (z60): the overlay's front rails cross in front of its legs while its torso + head
            read above — the slot. Position/scale unchanged from before; only its z sits between the plates. */}
        <StairClimber />

        {/* STAIR OVERLAY — front of the slot, full-canvas at (0,0), z60: above the avatar (z50), below
            the room plaques (z70) + HUD (z61) so the labels stay readable over the stairs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/foxpit/map/tower_layers/tower_stairs_overlay.webp" alt="" aria-hidden draggable={false}
          style={{ position: "absolute", top: 0, left: 0, zIndex: 60, width: "100%", height: "auto", display: "block" }} />

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
                zIndex: 70,
                top: `${r.mapY * 100}%`,
                left: "14%",
                // 75% of previous size (−25%): scale the WHOLE pill — container, text, checkmark,
                // border, padding — as one unit, anchored at its left edge + vertically centered on
                // the room, so it shrinks in place without moving.
                transform: "translateY(-50%) scale(0.75)",
                transformOrigin: "left center",
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
          <button
            onClick={() => setLoungeArrival(true)}
            style={{
              position: "absolute",
              zIndex: 70,
              top: `${WINNERS_LOUNGE.mapY * 100}%`,
              left: "14%",
              transform: "translateY(-50%) scale(0.75)", // −25%, matching the room plaques
              transformOrigin: "left center",
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: "74%",
              padding: "7px 12px",
              borderRadius: 999,
              cursor: "pointer",
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
          </button>
        )}

        {/* lobby landmark (street level, a hub — tap to return to the lobby) */}
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{
            position: "absolute",
            zIndex: 70,
            top: `${LOBBY_MAP_Y * 100}%`,
            left: "14%",
            transform: "translateY(-50%) scale(0.75)", // −25%, matching the room plaques
            transformOrigin: "left center",
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
            zIndex: 70,
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
          style={{ position: "absolute", zIndex: 91, top: 0, bottom: 0, left: 0, width: "12%", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
        />

        {/* elevator CABLE — a taut BRASS cable running the shaft; the car rides it.
            Centered on the car (car left 0.5% + half its 8% width ≈ 4.5%). The
            gradient reads as a round cord: dark brass edges, lit gold core. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            zIndex: 89,
            // Cable runs from the TOP of the Winner's Lounge room (the night-sky boundary ~10.5%, where
            // the building becomes visible below the exterior sky) down to the Dojo (bottom) stop — so
            // it reaches the top of the lounge but is never seen in the sky above it or below the Dojo
            // floor. The top dome + the car's base cap the ends.
            top: "10.5%",
            bottom: `${100 - ELEVATOR_STOP_BY_ID.dojo}%`,
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
            // z90 — the TOP layer, ABOVE the stair overlay (z60) + plaques (z70), so the car rides
            // visibly in the shaft instead of being buried behind the overlay plate.
            zIndex: 90,
            // PARKED at the High Table (high-rollers) landing — its approved default rest position.
            // 'top' is the car's BOTTOM edge (translateY(-100%) anchors bottom to the top:% line),
            // so it equals the stop pct directly. The demo climb-loop is retired; tap to ride.
            top: `${ELEVATOR_STOP_BY_ID.hightable}%`,
            left: "0.5%",
            width: "8%",
            transform: "translateY(-100%)",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            filter: elevatorUnlocked ? "none" : "grayscale(.55) brightness(.6)",
            animation: "none",
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

      {/* No loader screen: the tower WebP is preloaded during the lobby intro + cached, so the map
          paints effectively instantly. (Was a "CLIMBING THE TOWER…" spinner masking the old slow PNG load.) */}

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

      {/* Winner's Lounge entrance — played straight from the map plaque (parallels tapping any
          other room). Full-screen; the arrival component handles the glass door + plates. */}
      {loungeArrival && (
        <div style={{ position: "fixed", inset: 0, zIndex: 88, background: "#05070b" }}>
          <WinnersLoungeArrival onDone={() => setLoungeArrival(false)} />
        </div>
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
      // ABOVE the map (z2) covering only the exterior-sky band (top 10.5% ≈ y472 of 4500, just above
      // the Suite ceiling ~y480). This hides the map's baked direction labels ("New Map= Layer 1" and
      // the "Add Night Sky Here" black bar) with the actual skyline — keep the sky, drop the notes.
      style={{ position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, height: "10.5%", pointerEvents: "none", overflow: "hidden" }}
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

/** Front-facing corridor art for each floor — the elevator's back wall shows this floor's
 *  landing as you cycle to it (best available per-floor art; swap for true corridor plates later). */
const FLOOR_CORRIDOR: Record<string, string> = {
  dojo: "/foxpit/floors/floor_dojo.png",
  coliseum: "/foxpit/floors/floor_coliseum.png",
  hightable: "/foxpit/floors/floor_ravensnest.png",
  suite: "/foxpit/floors/floor_foxden.png",
  lobby: "/foxpit/lobby-scene.png",
  winners: "/foxpit/lounge/wl_plate_wide_establishing.png",
};
const corridorFor = (d: FloorDest) =>
  FLOOR_CORRIDOR[d.kind === "room" ? d.room.key : d.kind] ?? FLOOR_CORRIDOR.lobby;

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
  // Which floor the car is currently "on" — the corridor shown on the back wall. Cycled with ▲/▼.
  const [cursor, setCursor] = useState(0);
  const initedCursor = useRef(false);

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
  const destSub = (d: FloorDest) =>
    d.kind === "room" ? d.room.floorLabel : d.kind === "lobby" ? "Street level · Hub" : WINNERS_LOUNGE.floorLabel;
  const destUnlocked = (d: FloorDest) => (d.kind !== "room" ? true : lone || isUnlocked(d.room, cleared));

  // Open the car on the floor the player is CURRENTLY on (first not-yet-cleared room).
  useEffect(() => {
    if (initedCursor.current) return;
    initedCursor.current = true;
    const curKey = FOXPIT_ROOMS.find((r) => !cleared.has(r.key))?.key;
    const i = directory.findIndex((d) => d.kind === "room" && d.room.key === curKey);
    if (i >= 0) setCursor(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cycle = (dir: -1 | 1) => setCursor((c) => Math.max(0, Math.min(directory.length - 1, c + dir)));

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

      {/* INTERIOR — the car's BACK WALL is a front-facing view of the current floor's corridor;
          you cycle floors with the up/down call panel, then GO. (Doors already hard-cut away.) */}
      {(phase === "select" || phase === "riding") && (() => {
        const active = phase === "riding" && dest ? dest : directory[cursor]!;
        const unlocked = destUnlocked(active);
        const keyNeed = !unlocked && active.kind === "room" && active.room.needsKey ? KEY_ASSET[active.room.needsKey] : null;
        return (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
            {/* FLOOR CORRIDOR back wall — front-facing view of this floor's landing */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={corridorFor(active)} src={corridorFor(active)} alt={`${destName(active)} corridor`} draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: unlocked ? "none" : "grayscale(.7) brightness(.55)", animation: "foxpitFadeUp .4s ease both" }} />
            {/* legibility scrims — darker top + bottom so the brass reads over the art */}
            <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(5,7,11,.72), transparent 26%, transparent 40%, rgba(5,7,11,.86))" }} />

            {/* top bar — ELEVATOR label + close */}
            <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 14px)", left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
              <div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: ".14em", color: BRASS_LIT, textShadow: "0 2px 6px #000" }}>ELEVATOR</div>
                <div style={{ fontSize: 10, letterSpacing: ".24em", color: BRASS, fontWeight: 800 }}>{phase === "riding" ? "TRAVELING" : "SELECT A FLOOR"}</div>
              </div>
              {phase === "select" && (
                <button onClick={onClose} aria-label="Close" style={{ border: `1px solid ${BRASS}`, background: "rgba(0,0,0,.45)", color: BRASS_LIT, borderRadius: 10, padding: "6px 12px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>✕</button>
              )}
            </div>

            {/* BACK-WALL call panel — up/down cycles floors; the readout names this landing; GO travels */}
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom,0px) + 26px)", width: "min(86vw, 340px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 16px 18px", borderRadius: 16, background: `linear-gradient(180deg, ${BRASS}, ${BRASS_DARK})`, border: `2px solid ${BRASS_LIT}`, boxShadow: `0 10px 26px rgba(0,0,0,.6), inset 0 0 10px ${BRASS_LIT}`, zIndex: 2 }}>
              {/* ▲ up */}
              <button onClick={() => cycle(-1)} disabled={phase === "riding" || cursor === 0} aria-label="Up" style={{ width: 46, height: 34, borderRadius: 10, color: INK, fontSize: 16, fontWeight: 900, cursor: phase === "riding" || cursor === 0 ? "default" : "pointer", background: `radial-gradient(circle at 40% 30%, ${BRASS_LIT}, ${BRASS_DARK})`, border: `1.5px solid ${BRASS_LIT}`, opacity: cursor === 0 ? 0.4 : 1, boxShadow: phase === "riding" && dest ? `0 0 12px ${BRASS_LIT}` : "inset 0 1px 3px rgba(0,0,0,.5)" }}>▲</button>

              {/* readout — the floor this corridor belongs to */}
              <div style={{ width: "100%", textAlign: "center", background: "#0c0904", borderRadius: 8, padding: "8px 10px", border: `1px solid ${BRASS_DARK}` }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: BRASS_LIT, letterSpacing: ".06em", lineHeight: 1.1 }}>{destName(active)}</div>
                <div style={{ fontSize: 10, letterSpacing: ".14em", color: BRASS, fontWeight: 700, marginTop: 2 }}>{destSub(active)}</div>
                {keyNeed && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, fontSize: 11, color: "#e7cf93", fontWeight: 700 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={keyNeed.src} alt="" style={{ height: 16, width: "auto" }} /> Needs the {keyNeed.tier} key
                  </div>
                )}
              </div>

              {/* ▼ down */}
              <button onClick={() => cycle(1)} disabled={phase === "riding" || cursor === directory.length - 1} aria-label="Down" style={{ width: 46, height: 34, borderRadius: 10, color: INK, fontSize: 16, fontWeight: 900, cursor: phase === "riding" || cursor === directory.length - 1 ? "default" : "pointer", background: `radial-gradient(circle at 40% 30%, ${BRASS_LIT}, ${BRASS_DARK})`, border: `1.5px solid ${BRASS_LIT}`, opacity: cursor === directory.length - 1 ? 0.4 : 1, boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)" }}>▼</button>

              {/* GO / traveling */}
              {phase === "riding" ? (
                <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: "#fff", letterSpacing: ".08em", textShadow: "0 2px 8px #000" }}>Traveling to {destName(active)}…</div>
              ) : (
                <button onClick={() => unlocked && pick(active)} disabled={!unlocked} style={{ width: "100%", borderRadius: 12, padding: "12px 0", fontSize: 15, fontWeight: 900, letterSpacing: ".1em", color: unlocked ? "#1a1206" : "#7a6b45", background: unlocked ? `linear-gradient(180deg, ${BRASS_LIT}, ${BRASS})` : "rgba(12,9,4,.5)", border: `2px solid ${unlocked ? BRASS_LIT : BRASS_DARK}`, cursor: unlocked ? "pointer" : "default", boxShadow: unlocked ? `0 0 16px ${BRASS_LIT}88` : "none" }}>{unlocked ? "GO ›" : "LOCKED"}</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* WINNER'S LOUNGE arrival cinematic (Part B) — plays the four plates on first arrival. */}
      {phase === "lounge" && <WinnersLoungeArrival onDone={onClose} />}
    </div>
  );
}

/**
 * WINNER'S LOUNGE arrival cinematic (Part B) — the "you have arrived" payoff for beating Boss Fox.
 * Four plates open on the room and close on the throne, each a slow push-in cross-fading into the
 * next (~2.5s each). The final beat overlays Boss Fox ushering the player in (placeholder cutout —
 * swap when the art lands) and hands off to the lounge. Plays IN FULL the first arrival; auto-skips
 * on every later visit. Tap anywhere to skip. Dealer-less — no Locksmith here (B3).
 */
const LOUNGE_PLATES = [
  "/foxpit/lounge/wl_plate_wide_establishing.png", // open on the room
  "/foxpit/lounge/wl_plate_throne_left_3q.png",
  "/foxpit/lounge/wl_plate_throne_right_3q.png",
  "/foxpit/lounge/wl_plate_throne_straight.png", // close on the throne (the prize)
];
// The usher is the SAME boss-fox art shown when Boss Fox opens the Fox Pit door
// (suite room.avatarImg) — the full standing suited fox, rendered whole (contain), never cropped.
// Final-beat welcome cutout — Boss Fox welcomes the winner in. Composited over the throne-straight
// plate (never baked into it). 751x1299 transparent.
const LOUNGE_BOSS_FOX = "/foxpit/cutouts/bossfox_welcome_lounge.png";
/** Per-beat hold (ms) — the FULL establishing room shot lingers longest, then each throne plate.
 *  Every screen is well over 2.5s; the final beat (throne straight + Boss Fox) holds until "Step in". */
const LOUNGE_BEAT_MS = [3800, 3000, 3000];

function WinnersLoungeArrival({ onDone }: { onDone: () => void }) {
  const [firstTime] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return !localStorage.getItem("foxpit.lounge.arrived.v5");
    } catch (err) {
      console.error("[foxpit] lounge arrival flag read failed:", err);
      return true;
    }
  });
  const [beat, setBeat] = useState(0);
  // Interim: after the entrance (and the first-arrival throne cinematic), the lounge is a small
  // persistent HOME with the Snack Bar door in — reachable every visit, at leisure, until the
  // upstairs locker room is built. "Step in" from the throne beat lands here.
  const [steppedIn, setSteppedIn] = useState(false);
  // The Winner's Lounge ENTRANCE: the same tinted glass door + fox-neon badge as the Fox Pit
  // entrance, titled "Welcome to the Winner's Lounge". It swings open onto the establishing room
  // on EVERY arrival; the throne plates that follow play only on the FIRST arrival.
  const [showDoor, setShowDoor] = useState(true);
  const done = useRef(onDone);
  done.current = onDone;

  // Remember the first arrival so the plate cinematic is a one-time payoff (the door still opens
  // every time). Written on mount regardless of the door so it can't be missed.
  useEffect(() => {
    if (!firstTime) return;
    try {
      localStorage.setItem("foxpit.lounge.arrived.v5", "1");
    } catch (err) {
      console.error("[foxpit] lounge arrival flag write failed:", err);
    }
  }, [firstTime]);

  // Once the door has swung open: first-timers watch the plates (advanced below); returning
  // players drop straight into the lounge HOME (the Snack Bar door + back-to-map).

  // Advance the throne plates (first arrival only, after the door), holding on the final throne.
  useEffect(() => {
    if (!firstTime || showDoor || beat >= LOUNGE_PLATES.length - 1) return;
    const t = window.setTimeout(() => setBeat((b) => b + 1), LOUNGE_BEAT_MS[beat] ?? 3000);
    return () => window.clearTimeout(t);
  }, [firstTime, showDoor, beat]);

  // ENTRANCE door first (every arrival) — swings open onto the establishing room.
  if (showDoor) {
    return (
      <ArenaIntro
        onDone={() => setShowDoor(false)}
        revealTitle=""
        brandPrefix="to the"
        brandName="Winner's Lounge"
        revealImage={LOUNGE_PLATES[0]}
        showWordmark={false}
      />
    );
  }

  // Lounge HOME — the persistent room after the door: reached straight away by returning winners,
  // and via "Step in" on the first-arrival throne beat. Now the real LOCKER ROOM plate (§1.1) with the
  // opening locker, props, the Snack Bar phone, and a way to the elevator corridor.
  if (steppedIn || !firstTime) {
    return (
      <WinnersLoungeLocker onBack={() => done.current()} />
    );
  }

  const onThrone = beat === LOUNGE_PLATES.length - 1;

  return (
    <div onClick={() => done.current()} style={{ position: "absolute", inset: 0, zIndex: 5, background: "#05070b", overflow: "hidden", cursor: "pointer" }}>
      {LOUNGE_PLATES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 42%", opacity: beat === i ? 1 : 0, transition: "opacity .6s ease", animation: beat === i ? `foxpitPushIn ${((LOUNGE_BEAT_MS[i] ?? 3000) + 600) / 1000}s ease-in-out both` : "none" }}
        />
      ))}
      {beat === 0 && (
        <div style={{ position: "absolute", top: "8%", left: 0, right: 0, textAlign: "center", fontSize: 12, letterSpacing: ".3em", color: "#f5e3ac", fontWeight: 800, textShadow: "0 2px 10px #000", animation: "foxpitFadeUp .9s ease both" }}>WINNER&apos;S LOUNGE</div>
      )}
      {onThrone && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 26px)", animation: "foxpitFadeUp 1s ease both" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOUNGE_BOSS_FOX} alt="Boss Fox welcomes you in" draggable={false} style={{ height: "62%", width: "auto", maxWidth: "82%", objectFit: "contain", filter: "drop-shadow(0 10px 30px rgba(0,0,0,.8))" }} />
          {/* The welcome lives on the entrance door now; the payoff beat throws down the gauntlet.
              "Step in" hands off to the digital player table (B3) — currently returns to the map
              until that room is built (Frank to spec). */}
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#f5e3ac", textShadow: "0 2px 10px #000", marginTop: 6 }}>Ready to defend your throne?</div>
          <button onClick={(e) => { e.stopPropagation(); setSteppedIn(true); }} style={{ marginTop: 16, border: `2px solid ${BRASS}`, background: "rgba(200,162,75,.18)", color: "#fff", borderRadius: 12, padding: "12px 30px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Step in ›</button>
        </div>
      )}
      {!onThrone && (
        <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom,0px) + 16px)", right: 16, fontSize: 12, letterSpacing: ".1em", color: "rgba(245,227,172,.7)" }}>tap to skip</div>
      )}
    </div>
  );
}

