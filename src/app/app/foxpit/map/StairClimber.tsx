"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarRig } from "./AvatarRig";
import { FOXPIT_STAIR_ORIGIN } from "@/lib/foxpit/rules";

/**
 * FOX PIT — AVATAR STAIR CLIMB (Phase A).
 *
 * The avatar is a jointed WALK RIG (see AvatarRig) assembled from the 18 limb slices — no flat
 * cutout. Its limbs swing (rotation only) as it moves; facing flips at each switchback turn.
 *
 * The avatar climbs a switchback path of WAYPOINTS (x,y in % of tower_map_clean.png,
 * 1620x4500). Feet are anchored on the point: the rig's feet sit near the bottom of its figure
 * box (FOOT_PCT), so we translate the FEET onto the waypoint, not the box.
 *
 * CLIMB_WAYPOINTS is a first-pass GUESS — I'm blind to the new art's stair geometry. Turn on
 * CALIBRATE (the ⚙ button), drag the numbered dots onto the real treads/landings, then
 * copy the dumped JSON back so I can bake it. CLIMB_WAYPOINTS positions the AVATAR ONLY — the
 * post/rail SLOT sprites (SlotPieces, below) are hand-placed via their own ⚙ pieces drag pass.
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
/** Avatar box width as a fraction of the map width. The rig box is 2:1 (tall), so to match the
 *  old 611² cutout's rendered HEIGHT (15vw at width 15) the rig uses half that width. */
const AVATAR_W_VW = 7.5;

export interface Waypoint {
  x: number;
  y: number;
  landing?: boolean;
  label?: string;
}

// ── AVATAR SLOT PATH — the lane the avatar walks, traced onto the stairway_piece OVERLAY ──
// The staircase (stairway_piece @ map 610,2067) is the overlay; THIS is the slot the avatar walks
// through it, bottom (Dojo) → top (High Table) as a switchback. The two ends run HORIZONTALLY to the
// elevator ledge (ELEV_X) so the avatar walks to/from the elevator section of each end ledge.
// x,y in MAP px (1620x4500), stored as % so they survive rescale. Nudge nodes vs the device screenshot.
const MAP_W = 1620;
const MAP_H = 4500;
/** Travel per interpolated stride (map px) — one walk waypoint per this much path length. */
const STEP_RUN_PX = 42;
/** The elevator LEDGE x (map px) — the far-left gold-railed landing the avatar boards from. The
 *  elevator shaft is x≈0-70; its ledge sits at ≈100. (Was 380 — that landed in the room, not the shaft.) */
const ELEV_X = 120;

interface Node { x: number; y: number; stop?: boolean; label?: string }
/**
 * SWITCHBACK NODES — traced off the real staircase art (tower_stairs_overlay.webp), NOT guessed. The
 * stairs occupy map x≈80-640 (5-40%), y≈2160-4350 (bottom half: Dojo→High Table). Landings alternate
 * a LEFT platform (x≈260) and a RIGHT platform (x≈600) every ~280px. Stored as OFFSETS from the stair
 * origin so nudging the staircase slides the path with it. bottom → top.
 */
const STAIR_LOCAL: readonly [number, number][] = [
  [188, 2283], // Dojo · stair base (left)   abs (260, 4350)
  [528, 1933], //                    (right) abs (600, 4000)
  [188, 1583], //                    (left)  abs (260, 3650)
  [528, 1233], //                    (right) abs (600, 3300)
  [188, 883], //                     (left)  abs (260, 2950)
  [528, 533], //                     (right) abs (600, 2600)
  [188, 183], // High Table · top landing (left) abs (260, 2250)
];
/** Bottom → top. Elevator ends (fixed at ELEV_X, absolute y — the elevator doesn't move with the
 *  stair) bracket the origin-relative stair nodes. `stop` = a ledge to pause on. */
const PATH_NODES: Node[] = [
  { x: ELEV_X, y: 4350, stop: true, label: "Dojo · elevator" },
  ...STAIR_LOCAL.map(([lx, ly], i): Node => ({
    x: FOXPIT_STAIR_ORIGIN.x + lx,
    y: FOXPIT_STAIR_ORIGIN.y + ly,
    stop: i === 0 || i === STAIR_LOCAL.length - 1,
    label: i === 0 ? "Dojo · stair base" : i === STAIR_LOCAL.length - 1 ? "High Table · landing" : undefined,
  })),
  { x: ELEV_X, y: 2250, stop: true, label: "High Table · elevator" },
];

/** Walk path: interpolate ~one waypoint per STEP_RUN of travel along each node→node segment, so the
 *  rig strides the whole lane (stair flights + the horizontal elevator runs). Positions as % of map. */
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
  console.info(`[StairClimber] slot path: ${PATH_NODES.length} nodes → ${CLIMB_WAYPOINTS.length} waypoints`);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The climbing avatar — walks the switchback stairs bottom → top on a loop. No dev tools, no
 * calibration UI on screen. The rig's limbs swing (rotation only); the bent leg alternates each step.
 */
export function StairClimber() {
  const [wp] = useState<Waypoint[]>(CLIMB_WAYPOINTS);
  const [pos, setPos] = useState({ x: CLIMB_WAYPOINTS[0]!.x, y: CLIMB_WAYPOINTS[0]!.y, facing: 1 as 1 | -1, phase: 0 });
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gender = avatarGender();
  const busy = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const seg = useRef(0);

  const stepTo = useCallback((to: number, list: Waypoint[]) => {
    const from = to - 1;
    const a = list[from]!;
    const b = list[to]!;
    const facing: 1 | -1 = b.x >= a.x ? 1 : -1;
    busy.current = true;
    setMoving(true);
    const dur = 260; // per-tread step (the path is now tread-level, ~75 steps)
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      // Stride phase runs on a CONTINUOUS clock (not per-step), so it cycles through +/- across
      // consecutive steps — that's what makes the legs scissor and the bent leg ALTERNATE each step.
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

  // auto-climb loop. Guarded so a thrown frame surfaces, not swallowed.
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
          // reached the top — pause, reset to the bottom, climb again
          seg.current = 0;
          setPos({ x: wp[0]!.x, y: wp[0]!.y, facing: 1, phase: 0 });
          timer.current = window.setTimeout(tick, 1400);
          return;
        }
        // Walk to the next point. If it's a LEDGE, the avatar has reached a table — pause on it,
        // THEN the next step (the next flight) flips direction (the switchback turn).
        const arriving = wp[seg.current + 1];
        stepTo(seg.current + 1, wp);
        const dwell = arriving?.landing ? 750 : 90;
        timer.current = window.setTimeout(tick, 260 + dwell);
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
  }, [wp, stepTo]);

  return (
    // z61 = ABOVE the stair overlay (z60). The overlay is the FULL staircase (treads + rails, not a
    // front-rail-only slice), so at z50 the avatar was redrawn OVER by the whole staircase and vanished.
    // Rendering above the overlay puts the avatar visibly ON the treads (still below plaques z70 + the
    // elevator car z90). A true slot (near-rail crossing the legs) needs a separate front-rail art layer.
    <div style={{ position: "absolute", inset: 0, zIndex: 61, pointerEvents: "none" }}>
      {/* the walking avatar RIG — feet anchored on the waypoint; the rig flips + swings internally;
          bob adds a little life while moving. No dev tools on screen. */}
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
