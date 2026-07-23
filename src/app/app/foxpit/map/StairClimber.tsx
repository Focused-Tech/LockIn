"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FOX PIT — AVATAR STAIR CLIMB (Phase A).
 *
 * Frank's call: use the SINGLE walk cutout (avatar-climber.png, one mid-stride pose)
 * rather than a multi-frame cycle — those frames were never delivered. We sell the walk
 * with a bob + a facing flip at each switchback (the accepted trade-off for a single pose).
 *
 * The avatar climbs a switchback path of WAYPOINTS (x,y in % of tower_map_clean.png,
 * 1620x4500). Feet are anchored on the point: the figure sits 86.4% down its 611² canvas
 * (13.6% transparent below), so we translate the FEET onto the waypoint, not the box.
 *
 * CLIMB_WAYPOINTS is a first-pass GUESS — I'm blind to the new art's stair geometry. Turn on
 * CALIBRATE (the ⚙ button), drag the numbered dots onto the real treads/landings, then
 * copy the dumped JSON back so I can bake it. The front-rail SLOT sprites (LandingRails, below)
 * anchor to the SAME landing waypoints, so calibrating the path also positions the rails.
 */

// ── design tokens (named) ──
const PAW_GOLD = "#d9a441";
const GUIDE_CYAN = "rgba(0,229,255,.9)";
const HANDLE_RED = "rgba(252,62,1,.92)";
const HANDLE_RING = "#ffffff";
const DUMP_GREEN = "#9fe0b0";
const PANEL_INK = "rgba(6,8,12,.9)";

const AVATAR_SRC = "/foxpit/avatar-climber.png";
/** Feet sit 86.4% down the 611² canvas — anchor the feet, not the box bottom. */
const FOOT_PCT = 86.4;
/** Avatar box width as a fraction of the map width (tuned on device). */
const AVATAR_W_VW = 15;

export interface Waypoint {
  x: number;
  y: number;
  landing?: boolean;
  label?: string;
}

/** SEED switchback path (bottom → top), % of the 1620x4500 build map. Landings align to
 *  ELEVATOR_STOPS. GUESS — calibrate on device, then paste JSON back to bake. Exported so
 *  the front-rail sprites anchor to the SAME (calibrated) landing coordinates. */
export const CLIMB_WAYPOINTS: Waypoint[] = [
  { x: 34, y: 97.0, label: "Dojo floor" },
  { x: 55, y: 92.0 },
  { x: 30, y: 87.3, landing: true, label: "Lobby landing" },
  { x: 58, y: 80.5 },
  { x: 32, y: 75.2, landing: true, label: "Coliseum · lower" },
  { x: 60, y: 69.5 },
  { x: 34, y: 64.0, landing: true, label: "Coliseum · upper" },
  { x: 60, y: 57.0 },
  { x: 34, y: 49.7, landing: true, label: "High Table landing" },
  { x: 58, y: 43.2 },
  { x: 32, y: 37.1, landing: true, label: "Suite landing" },
  { x: 52, y: 31.8 },
  { x: 36, y: 26.8, landing: true, label: "Winner's Lounge landing" },
];

// ── FRONT-RAIL SLOT — the Z-depth sandwich ──
// A slot is NOT a gap in a fence. Per landing it is three render layers, back → front:
//   LAYER 1  the map art (immutable — includes the baked BACK rail)
//   LAYER 2  the AVATAR sprite
//   LAYER 3  ONE front-rail SPRITE, z-index ABOVE the avatar
// The avatar reads as standing BETWEEN the back rail and the front rail. The map bitmap is
// finished, immutable art — NOTHING is ever baked onto it. Each landing gets exactly ONE piece
// file, loaded as its own sprite: no composites, no stitched fences, no invented/mirrored pieces.
interface LandingRail {
  /** index into CLIMB_WAYPOINTS — MUST be a landing entry */
  wp: number;
  /** the ONE stair-piece file for this landing (no composites) */
  piece: string;
  /** on-screen width as a fraction of map width — scale-to-fit ONLY (no reshape/recolor) */
  widthVw: number;
}

// One DISTINCT piece per landing. Piece choices + widths are FIRST-PASS — matching a piece to
// each landing by on-screen size needs Frank's calibration; confirm or swap once the JSON lands.
// Positions are NOT here — they come from CLIMB_WAYPOINTS[wp] (calibrated), never hardcoded.
const LANDING_RAILS: LandingRail[] = [
  { wp: 2, piece: "rail_02", widthVw: 22 }, // Lobby landing
  { wp: 4, piece: "rail_03", widthVw: 22 }, // Coliseum · lower
  { wp: 6, piece: "rail_05", widthVw: 22 }, // Coliseum · upper
  { wp: 8, piece: "rail_08", widthVw: 22 }, // High Table landing
  { wp: 10, piece: "rail_12", widthVw: 22 }, // Suite landing
  { wp: 12, piece: "rail_14", widthVw: 22 }, // Winner's Lounge landing
];

/**
 * FRONT-RAIL layer — ONE sprite per landing, z-index ABOVE the avatar (avatar z5 < rails z6),
 * anchored (bottom-center) to that landing's waypoint. This is LAYER 3 of the slot sandwich:
 * a runtime sprite, never baked into the map, never blocking the walkway. Position is driven by
 * CLIMB_WAYPOINTS (calibrated on device) — no hardcoded coordinates.
 */
export function LandingRails() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
      {LANDING_RAILS.map((lr) => {
        const p = CLIMB_WAYPOINTS[lr.wp];
        if (!p || !p.landing) {
          // No silent catch — a bad landing mapping surfaces in the console.
          console.error(`[LandingRails] CLIMB_WAYPOINTS[${lr.wp}] is not a landing`);
          return null;
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={lr.piece}
            src={`/foxpit/map/stair_pieces/${lr.piece}.png`}
            alt=""
            draggable={false}
            style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: `${lr.widthVw}vw`, height: "auto", transform: "translate(-50%,-100%)" }}
          />
        );
      })}
    </div>
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The climbing avatar. Auto-climbs bottom → top on a loop so every landing is visible for
 * a screenshot. ⚙ toggles CALIBRATE: drag the dots, copy the JSON.
 */
export function StairClimber() {
  const [wp, setWp] = useState<Waypoint[]>(CLIMB_WAYPOINTS);
  const [pos, setPos] = useState({ x: CLIMB_WAYPOINTS[0]!.x, y: CLIMB_WAYPOINTS[0]!.y, facing: 1 });
  const [moving, setMoving] = useState(false);
  const [calibrate, setCalibrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const seg = useRef(0);
  const dragging = useRef<number | null>(null);

  const stepTo = useCallback((to: number, list: Waypoint[]) => {
    const from = to - 1;
    const a = list[from]!;
    const b = list[to]!;
    const facing = b.x >= a.x ? 1 : -1;
    busy.current = true;
    setMoving(true);
    const dur = 1000;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      setPos({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, facing });
      if (t < 1) {
        raf.current = requestAnimationFrame(frame);
      } else {
        busy.current = false;
        setMoving(false);
        seg.current = to;
      }
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  // auto-climb loop (paused while calibrating). Guarded so a thrown frame surfaces, not swallowed.
  useEffect(() => {
    if (calibrate) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      try {
        if (busy.current) {
          timer.current = window.setTimeout(tick, 200);
          return;
        }
        if (seg.current >= wp.length - 1) {
          // reached the top — pause, reset to the bottom, climb again
          seg.current = 0;
          setPos({ x: wp[0]!.x, y: wp[0]!.y, facing: 1 });
          timer.current = window.setTimeout(tick, 1400);
          return;
        }
        stepTo(seg.current + 1, wp);
        timer.current = window.setTimeout(tick, 1000 + 380);
      } catch (err) {
        // No silent catch — surface it.
        console.error("[StairClimber] climb loop failed", err);
        setError(String(err));
      }
    };
    timer.current = window.setTimeout(tick, 700);
    return () => {
      alive = false;
      if (timer.current) window.clearTimeout(timer.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [calibrate, wp, stepTo]);

  // calibrate: drag a numbered dot → update its waypoint (in % of the container)
  const onDrag = (e: React.PointerEvent) => {
    const i = dragging.current;
    if (i === null || !rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    setWp((prev) => prev.map((p, k) => (k === i ? { ...p, x: +x.toFixed(1), y: +y.toFixed(1) } : p)));
  };

  const dumpJson = JSON.stringify(wp.map((p) => ({ x: p.x, y: p.y, ...(p.landing ? { landing: true } : {}) })));

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: calibrate ? "auto" : "none" }}
      onPointerMove={calibrate ? onDrag : undefined}
      onPointerUp={() => (dragging.current = null)}
    >
      {/* the walking avatar — feet anchored on the waypoint; scaleX flips at switchbacks;
          bob sells the single-pose walk while moving. */}
      <div
        style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: `${AVATAR_W_VW}vw`,
          transform: `translate(-50%, -${FOOT_PCT}%)`,
          pointerEvents: "none",
          zIndex: 5,
          filter: "drop-shadow(0 4px 4px rgba(0,0,0,.7))",
        }}
      >
        <div style={{ animation: moving ? "foxpitClimberBob .5s ease-in-out infinite" : "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={AVATAR_SRC} alt="Climbing player" draggable={false} style={{ width: "100%", height: "auto", display: "block", transform: `scaleX(${pos.facing})` }} />
        </div>
      </div>

      {/* calibrate overlay: guide line + numbered draggable dots */}
      {calibrate && (
        <>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline points={wp.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={GUIDE_CYAN} strokeWidth={0.4} />
          </svg>
          {wp.map((p, i) => (
            <div
              key={i}
              onPointerDown={(e) => { dragging.current = i; e.stopPropagation(); }}
              style={{
                position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)",
                width: 22, height: 22, borderRadius: "50%", background: p.landing ? PAW_GOLD : HANDLE_RED,
                border: `2px solid ${HANDLE_RING}`, color: "#fff", fontSize: 11, fontWeight: 800,
                display: "grid", placeItems: "center", cursor: "grab", touchAction: "none", zIndex: 7,
              }}
            >
              {i}
            </div>
          ))}
        </>
      )}

      {/* ⚙ calibrate toggle + JSON dump (dev tool; always tappable) */}
      <button
        onClick={() => setCalibrate((c) => !c)}
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 60px)", right: 8, zIndex: 9, pointerEvents: "auto", border: `1px solid ${PAW_GOLD}`, background: PANEL_INK, color: PAW_GOLD, borderRadius: 8, padding: "5px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
      >
        {calibrate ? "✓ done" : "⚙ cal"}
      </button>
      {calibrate && (
        <textarea
          readOnly
          value={dumpJson}
          onFocus={(e) => e.currentTarget.select()}
          style={{ position: "absolute", left: 8, right: 8, bottom: "calc(env(safe-area-inset-bottom,0px) + 12px)", height: 70, zIndex: 9, pointerEvents: "auto", background: "#0a0c11", color: DUMP_GREEN, border: "1px solid #222", borderRadius: 8, fontSize: 10, fontFamily: "ui-monospace, monospace", padding: 8 }}
        />
      )}

      {error && (
        <div style={{ position: "absolute", left: 8, right: 8, top: "calc(env(safe-area-inset-top,0px) + 100px)", zIndex: 9, pointerEvents: "none", background: "rgba(120,0,0,.9)", color: "#fff", borderRadius: 8, padding: 10, fontSize: 12 }}>
          Climb error: {error}
        </div>
      )}
    </div>
  );
}
