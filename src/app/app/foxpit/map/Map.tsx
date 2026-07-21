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
  getCleared,
  isUnlocked,
  keyLabel,
  roomByKey,
  type FoxPitRoomKey,
} from "@/lib/foxpit";

/**
 * Fox Pit TOWER MAP (background = map/tower-map-stairs.png, stairs-only) — a tall vertical climb with
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
  const [floorSelect, setFloorSelect] = useState(false);
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* TOWER_H = fixed vertical scale: 315vw ≈ the old map's on-screen height,
            so rooms read at a comfortable size and the climb scrolls. Tune this one
            number to taste (bigger = taller rooms + more scroll). */}
        <img
          src="/foxpit/map/tower-map-stairs.png"
          alt="The Fox Pit tower"
          draggable={false}
          onLoad={fitTower}
          style={{ width: "100%", height: "315vw", objectFit: "fill", display: "block" }}
        />

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
            The Lobby
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

        {/* elevator CABLE — a taut cable running the shaft; the car rides it.
            Centered on the car (car left 0.5% + half its 8% width ≈ 4.5%). */}
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
            background: "linear-gradient(90deg, rgba(120,120,130,.12), rgba(205,210,220,.9) 45%, rgba(120,120,130,.12))",
            boxShadow: "0 0 5px rgba(0,0,0,.6)",
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
            top: "95%",
            left: "0.5%",
            width: "8%",
            transform: "translateY(-100%)",
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            filter: elevatorUnlocked ? "none" : "grayscale(.55) brightness(.6)",
            animation: elevatorUnlocked
              ? "foxpitElevatorStops 24s ease-in-out infinite"
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

      {floorSelect && (
        <FloorSelectPanel
          lone={lone}
          cleared={cleared}
          onClose={() => setFloorSelect(false)}
          onPick={(k) => {
            setFloorSelect(false);
            enter(k);
          }}
        />
      )}

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
              The elevator stays out of service until you reach{" "}
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

/** The elevator's floor-select — the four room cards + the tiered keys you've won. */
function FloorSelectPanel({
  lone,
  cleared,
  onClose,
  onPick,
}: {
  lone: boolean;
  cleared: Set<FoxPitRoomKey>;
  onClose: () => void;
  onPick: (k: FoxPitRoomKey) => void;
}) {
  const won = FOXPIT_ROOMS.filter((r) => cleared.has(r.key));
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(3,4,7,.86)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "84px 18px 24px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".1em", color: "#E7E7EB" }}>
            ELEVATOR · SELECT A FLOOR
          </div>
        </div>

        {/* keys won */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minHeight: 54,
            marginBottom: 16,
            padding: "8px 12px",
            borderRadius: 12,
            background: "rgba(10,13,18,.6)",
            border: "1px solid rgba(200,162,75,.3)",
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: ".16em", color: "#8b98a6", fontWeight: 800 }}>
            KEYS WON
          </span>
          {won.length === 0 ? (
            <span style={{ fontSize: 12, color: "#6b7a8e" }}>None yet — clear a floor to earn its key</span>
          ) : (
            won.map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={r.key}
                src={KEY_ASSET[r.bossArt].src}
                alt={`${r.boss} key`}
                title={`${KEY_ASSET[r.bossArt].tier} · ${r.boss}`}
                style={{ height: 40, width: "auto", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}
              />
            ))
          )}
        </div>

        {/* the four room cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {FOXPIT_ROOMS.map((r) => {
            const unlocked = lone || isUnlocked(r, cleared);
            const done = cleared.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => unlocked && onPick(r.key)}
                disabled={!unlocked}
                style={{
                  position: "relative",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: `2px solid ${done ? "#22C55E" : unlocked ? r.accent : "#3a4653"}`,
                  boxShadow: unlocked ? `0 0 16px ${r.accent}33, 0 8px 20px rgba(0,0,0,.5)` : "none",
                  cursor: unlocked ? "pointer" : "not-allowed",
                  aspectRatio: "3 / 4",
                  background: "#0a0d13",
                  filter: unlocked ? "none" : "grayscale(.6) brightness(.6)",
                  padding: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.roomImg}
                  alt={r.name}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 45%,rgba(3,4,7,.92))" }} />

                {/* won key badge (top-right) */}
                {done && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={KEY_ASSET[r.bossArt].src}
                    alt={`${r.boss} key`}
                    style={{ position: "absolute", top: 8, right: 8, height: 34, width: "auto", filter: "drop-shadow(0 2px 5px #000)" }}
                  />
                )}

                <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, textAlign: "left" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#E7E7EB", fontWeight: 700 }}>
                    {r.name}
                  </div>
                  {done ? (
                    <div style={{ fontSize: 10, letterSpacing: ".1em", color: "#22C55E", fontWeight: 800, marginTop: 2 }}>
                      ✓ CLEARED
                    </div>
                  ) : unlocked ? (
                    <div style={{ fontSize: 10, letterSpacing: ".1em", color: r.accent, fontWeight: 800, marginTop: 2 }}>
                      ENTER ›
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, letterSpacing: ".06em", color: "#c8a24b", fontWeight: 800, marginTop: 2 }}>
                      <LockGlyph size={11} /> NEEDS {keyLabel(r.needsKey!)} KEY
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            display: "block",
            margin: "20px auto 0",
            border: "1px solid rgba(231,231,235,.3)",
            background: "transparent",
            color: "#c3cedb",
            borderRadius: 12,
            padding: "12px 26px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
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

/**
 * Elevator interior + ride. Click the car → the ornate doors slide OPEN to the
 * brass interior → pick a floor → doors CLOSE → the car travels → arrive (routes
 * into that room's usher→boss door sequence).
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
  const [phase, setPhase] = useState<"opening" | "select" | "closing" | "riding">("opening");
  const [frame, setFrame] = useState(0);
  const [dest, setDest] = useState<FoxPitRoomKey | null>(null);

  // doors open: 0 → last
  useEffect(() => {
    if (phase !== "opening") return;
    if (frame < ELEVATOR_FRAMES.length - 1) {
      const t = setTimeout(() => setFrame((f) => f + 1), 240);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("select"), 350);
    return () => clearTimeout(t);
  }, [phase, frame]);

  // doors close: last → 0
  useEffect(() => {
    if (phase !== "closing") return;
    if (frame > 0) {
      const t = setTimeout(() => setFrame((f) => f - 1), 240);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("riding"), 300);
    return () => clearTimeout(t);
  }, [phase, frame]);

  // travel, then arrive at the floor
  useEffect(() => {
    if (phase !== "riding" || !dest) return;
    const t = setTimeout(() => onArrive(dest), 1700);
    return () => clearTimeout(t);
  }, [phase, dest, onArrive]);

  const pick = (k: FoxPitRoomKey) => { setDest(k); setPhase("closing"); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 85, background: "#05070b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {phase === "select" && (
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 14, zIndex: 3, border: "1px solid rgba(200,162,75,.5)", background: "rgba(3,4,7,.6)", color: "#d8c79b", borderRadius: 10, padding: "6px 12px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>✕</button>
      )}

      <div style={{ position: "relative", height: "92%", aspectRatio: "1 / 1", maxWidth: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ELEVATOR_FRAMES[frame]} alt="Elevator" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 44px rgba(200,162,75,.22))" }} />

        {phase === "select" && (
          <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)", width: "60%", display: "flex", flexDirection: "column", gap: 8, animation: "foxpitFadeUp .5s ease both" }}>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: ".18em", color: "#e0cf9f", fontWeight: 800, textShadow: "0 2px 6px #000" }}>SELECT A FLOOR</div>
            {FOXPIT_ROOMS.slice().reverse().map((r) => {
              const unlocked = lone || isUnlocked(r, cleared);
              const done = cleared.has(r.key);
              return (
                <button key={r.key} onClick={() => unlocked && pick(r.key)} disabled={!unlocked}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 12px", borderRadius: 10, cursor: unlocked ? "pointer" : "not-allowed", background: "rgba(6,8,12,.82)", border: `1.5px solid ${done ? "#22C55E" : unlocked ? r.accent : "#3a4653"}`, color: "#E7E7EB", filter: unlocked ? "none" : "grayscale(.5) brightness(.7)" }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 700 }}>{r.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: done ? "#22C55E" : unlocked ? r.accent : "#c8a24b" }}>{done ? "✓" : unlocked ? "GO ›" : `${keyLabel(r.needsKey!)} KEY`}</span>
                </button>
              );
            })}
          </div>
        )}

        {phase === "riding" && (
          <div style={{ position: "absolute", left: "50%", top: "45%", transform: "translate(-50%,-50%)", textAlign: "center", animation: "foxpitFadeUp .4s ease both" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#f5ead0", letterSpacing: ".1em", textShadow: "0 2px 12px #000" }}>Traveling…</div>
          </div>
        )}
      </div>
    </div>
  );
}
