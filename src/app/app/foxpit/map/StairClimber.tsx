"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarRig } from "./AvatarRig";

/**
 * FOX PIT — AVATAR STAIR CLIMB.
 *
 * The avatar is a jointed WALK RIG (AvatarRig) — its limbs swing as it moves and its facing flips at
 * each switchback turn. It climbs the switchback staircase bottom (Dojo) → top (High Table).
 *
 * The path is NO LONGER GUESSED. TRACE_CENTERLINE is the staircase's real walkable tread centerline,
 * EXTRACTED from the staircase art (tower_stairs_overlay.webp) by alpha-centroid per row, excluding the
 * elevator shaft band (scripts/stair-centerline.mjs). It zigzags x≈22%↔48% up the tower — the earlier
 * flat 16%↔37% guess is why the avatar sat off the treads. Turn on ?stairtrace=1 to render the CYAN
 * staircase centerline vs the RED old-guess path and eyeball the diff on-device.
 */

/** One full stride cycle (ms) while moving — drives the rig's contra-lateral swing phase. */
const STRIDE_MS = 720;
/** Feet sit near the bottom of the rig figure box — anchor the FEET onto the waypoint, not the box. */
const FOOT_PCT = 95;
/** Avatar gender selects the male or female rig slices; persisted per user later, male for now. */
function avatarGender(): "male" | "female" {
  if (typeof window === "undefined") return "male";
  try { return localStorage.getItem("foxpit.avatar") === "female" ? "female" : "male"; }
  catch { return "male"; }
}
/** Avatar box width as a fraction of the map width. Sized so the rig's HANDS clear the gold rail height
 *  but the figure stays SHORTER than the elevator car (Frank's spec). Was 7.5 (too small). */
const AVATAR_W_VW = 11;

const MAP_W = 1620;
const MAP_H = 4500;
/** Travel per interpolated stride (map px) — one walk waypoint per this much path length. */
const STEP_RUN_PX = 42;
/** The elevator LEDGE x (map px) — the far-left gold-railed landing the avatar boards from. */
const ELEV_X = 120;

export interface Waypoint {
  x: number;
  y: number;
  landing?: boolean;
  label?: string;
}

// ── STAIRCASE TREAD CENTERLINE (Dojo → High Table) ──────────────────────────────────────────────
// EXTRACTED from tower_stairs_overlay.webp (alpha centroid per row, elevator band removed). % of map.
// This is the CYAN reference the avatar now walks — the real switchback, not a guess.
const TRACE_CENTERLINE: readonly { x: number; y: number }[] = [
  {x:21.8,y:96.67},{x:22.59,y:96.22},{x:23.31,y:95.78},{x:24.07,y:95.33},{x:25.59,y:94.89},{x:26.91,y:94.44},{x:28.36,y:94},{x:30.43,y:93.56},{x:33.25,y:93.11},{x:35.97,y:92.67},{x:38.83,y:92.22},{x:41.51,y:91.78},{x:43.26,y:91.33},{x:44.52,y:90.89},{x:44.34,y:90.44},{x:43.74,y:90},{x:42.79,y:89.56},{x:42.35,y:89.11},{x:41.18,y:88.67},{x:39.83,y:88.22},{x:38.61,y:87.78},{x:35.11,y:87.33},{x:31.13,y:86.89},{x:28.08,y:86.44},{x:25.77,y:86},{x:23.64,y:85.56},{x:23.26,y:85.11},{x:24.07,y:84.67},{x:25.32,y:84.22},{x:26.35,y:83.78},{x:27.31,y:83.33},{x:29.24,y:82.89},{x:30.44,y:82.44},{x:32.08,y:82},{x:33.63,y:81.56},{x:36.53,y:81.11},{x:39.25,y:80.67},{x:41.73,y:80.22},{x:43.45,y:79.78},{x:44.61,y:79.33},{x:44.29,y:78.89},{x:43.65,y:78.44},{x:42.68,y:78},{x:42.2,y:77.56},{x:41,y:77.11},{x:39.72,y:76.67},{x:38.47,y:76.22},{x:35.85,y:75.78},{x:32.64,y:75.33},{x:29.58,y:74.89},{x:27.26,y:74.44},{x:25.1,y:74},{x:24.57,y:73.56},{x:24.28,y:73.11},{x:25.6,y:72.67},{x:26.58,y:72.22},{x:27.65,y:71.78},{x:29.05,y:71.33},{x:30.76,y:70.89},{x:32.34,y:70.44},{x:33.84,y:70},{x:36.47,y:69.56},{x:38.88,y:69.11},{x:40.98,y:68.67},{x:42.57,y:68.22},{x:43.69,y:67.78},{x:43.58,y:67.33},{x:43.05,y:66.89},{x:42.28,y:66.44},{x:41.8,y:66},{x:40.65,y:65.56},{x:39.26,y:65.11},{x:36.63,y:64.67},{x:33.06,y:64.22},{x:29.61,y:63.78},{x:27.16,y:63.33},{x:24.94,y:62.89},{x:24.31,y:62.44},{x:24.76,y:62},{x:25.43,y:61.56},{x:26.34,y:61.11},{x:27.36,y:60.67},{x:28.54,y:60.22},{x:30.26,y:59.78},{x:31.87,y:59.33},{x:33.35,y:58.89},{x:37.11,y:58.44},{x:40.56,y:58},{x:43.81,y:57.56},{x:46.26,y:57.11},{x:48.46,y:56.67},{x:48.24,y:56.22},{x:48.13,y:55.78},{x:47.52,y:55.33},{x:47.03,y:54.89},{x:47.33,y:54.44},{x:46.44,y:54},{x:45.14,y:53.56},{x:43.31,y:53.11},{x:41.32,y:52.67},{x:38.13,y:52.22},{x:36.09,y:51.78},{x:34.2,y:51.33},{x:32.29,y:50.89},{x:30.75,y:50.44},{x:29.78,y:50},{x:28.98,y:49.56},{x:28.23,y:49.11},{x:28.25,y:48.67},{x:28.28,y:48.22},
];

// The OLD guessed switchback (flat 16%↔37%), kept ONLY to draw the RED "before" trace in ?stairtrace.
const OLD_PATH_PCT: readonly { x: number; y: number }[] = [
  {x:7.4,y:96.7},{x:16.0,y:96.7},{x:37.0,y:88.9},{x:16.0,y:81.1},{x:37.0,y:73.3},{x:16.0,y:65.6},{x:37.0,y:57.8},{x:16.0,y:50.0},{x:7.4,y:50.0},
];

interface Node { x: number; y: number; stop?: boolean; label?: string }
/** Bottom → top. Elevator ledges (fixed at ELEV_X) bracket the extracted tread centerline: the avatar
 *  runs horizontally off the Dojo elevator, climbs the treads, then runs to the High Table elevator. */
const PATH_NODES: Node[] = (() => {
  const cl = TRACE_CENTERLINE.map((p) => ({ x: (p.x / 100) * MAP_W, y: (p.y / 100) * MAP_H }));
  const first = cl[0]!, last = cl[cl.length - 1]!;
  return [
    { x: ELEV_X, y: first.y, stop: true, label: "Dojo · elevator" },
    ...cl.map((p, i): Node => ({ x: p.x, y: p.y, stop: i === 0 || i === cl.length - 1,
      label: i === 0 ? "Dojo · stair base" : i === cl.length - 1 ? "High Table · landing" : undefined })),
    { x: ELEV_X, y: last.y, stop: true, label: "High Table · elevator" },
  ];
})();

/** Walk path: interpolate ~one waypoint per STEP_RUN of travel along each node→node segment. % of map. */
export const CLIMB_WAYPOINTS: Waypoint[] = (() => {
  const p0 = PATH_NODES[0]!;
  const wp: Waypoint[] = [{ x: (p0.x / MAP_W) * 100, y: (p0.y / MAP_H) * 100, landing: true, label: p0.label }];
  for (let i = 1; i < PATH_NODES.length; i++) {
    const a = PATH_NODES[i - 1]!, b = PATH_NODES[i]!;
    const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / STEP_RUN_PX));
    for (let k = 1; k <= n; k++) {
      const t = k / n, isNode = k === n;
      wp.push({
        x: ((a.x + (b.x - a.x) * t) / MAP_W) * 100,
        y: ((a.y + (b.y - a.y) * t) / MAP_H) * 100,
        landing: isNode && !!b.stop,
        label: isNode ? b.label : undefined,
      });
    }
  }
  return wp;
})();

if (typeof window !== "undefined") {
  console.info(`[StairClimber] centerline path: ${PATH_NODES.length} nodes → ${CLIMB_WAYPOINTS.length} waypoints`);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const toPolyline = (pts: readonly { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

/**
 * The climbing avatar — walks the switchback stairs bottom → top on a loop. The rig's limbs swing
 * (rotation only); the bent leg alternates each step. ?stairtrace=1 overlays the calibration diff.
 */
export function StairClimber() {
  const [wp] = useState<Waypoint[]>(CLIMB_WAYPOINTS);
  const [pos, setPos] = useState({ x: CLIMB_WAYPOINTS[0]!.x, y: CLIMB_WAYPOINTS[0]!.y, facing: 1 as 1 | -1, phase: 0 });
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState(false);
  const gender = avatarGender();
  const busy = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const seg = useRef(0);

  useEffect(() => {
    try { setTrace(new URLSearchParams(window.location.search).has("stairtrace")); } catch {}
  }, []);

  const stepTo = useCallback((to: number, list: Waypoint[]) => {
    const from = to - 1;
    const a = list[from]!;
    const b = list[to]!;
    const facing: 1 | -1 = b.x >= a.x ? 1 : -1;
    busy.current = true;
    setMoving(true);
    const dur = 260; // per-tread step
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      const phase = (now / STRIDE_MS) % 1;
      setPos({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, facing, phase });
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

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      try {
        if (busy.current) {
          timer.current = window.setTimeout(tick, 200);
          return;
        }
        if (seg.current >= wp.length - 1) {
          seg.current = 0;
          setPos({ x: wp[0]!.x, y: wp[0]!.y, facing: 1, phase: 0 });
          timer.current = window.setTimeout(tick, 1400);
          return;
        }
        const arriving = wp[seg.current + 1];
        stepTo(seg.current + 1, wp);
        const dwell = arriving?.landing ? 750 : 90;
        timer.current = window.setTimeout(tick, 260 + dwell);
      } catch (err) {
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
  }, [wp, stepTo]);

  return (
    // z61 = ABOVE the stair overlay (z60). A true slot (near-rail crossing the legs) needs a separate
    // front-rail art layer; z61 keeps the avatar visibly ON the treads (below plaques z70 + car z90).
    <div style={{ position: "absolute", inset: 0, zIndex: 61, pointerEvents: "none" }}>
      {/* CALIBRATION DIFF — ?stairtrace=1. CYAN = extracted staircase centerline (where the avatar now
          walks); RED = the old guessed path. Eyeball on-device whether cyan sits on the real treads. */}
      {trace && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 62, pointerEvents: "none" }}>
          <polyline points={toPolyline(OLD_PATH_PCT)} fill="none" stroke="#FF2D2D" strokeWidth={0.5} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" />
          <polyline points={toPolyline(TRACE_CENTERLINE)} fill="none" stroke="#00E5FF" strokeWidth={0.5} strokeOpacity={0.95} vectorEffect="non-scaling-stroke" />
          {TRACE_CENTERLINE.filter((_, i) => i % 6 === 0).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.4} fill="#00E5FF" />
          ))}
        </svg>
      )}

      <div
        style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: `${AVATAR_W_VW}vw`,
          transform: `translate(-50%, -${FOOT_PCT}%)`,
          pointerEvents: "none",
          zIndex: 50,
          filter: "drop-shadow(0 4px 4px rgba(0,0,0,.7))",
        }}
      >
        <div style={{ animation: moving ? "foxpitClimberBob .5s ease-in-out infinite" : "none" }}>
          <AvatarRig gender={gender} phase={pos.phase} facing={pos.facing} />
        </div>
      </div>

      {error && (
        <div style={{ position: "absolute", left: 8, right: 8, top: "calc(env(safe-area-inset-top,0px) + 100px)", zIndex: 9, pointerEvents: "none", background: "rgba(120,0,0,.9)", color: "#fff", borderRadius: 8, padding: 10, fontSize: 12 }}>
          Climb error: {error}
        </div>
      )}
    </div>
  );
}
