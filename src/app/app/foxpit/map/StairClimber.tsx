"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarRig } from "./AvatarRig";

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

// ── STAIR PATH — DERIVED FROM THE TREADS (traced off tower_staircase_clean.png, aligns 1:1) ──
// The staircase is a SWITCHBACK: flights alternate direction, a ledge caps each flight, and a
// ledge is a STEP too (treads, ledge, treads, ledge…). Ledge extremes were read by tracing the
// tread band per row on the art. ONE measured constant: the horizontal step run per tread.
const MAP_W = 1620;
const MAP_H = 4500;
/** MEASURED: horizontal run per tread on the 1620x4500 map (starting pitch; verify vs the render). */
const STEP_RUN_PX = 35.5;

/** Ledge (flight-cap) extremes, BOTTOM (Dojo floor) → TOP (High Table landing). side = the wall the
 *  ledge sits against; flights alternate between them. */
interface Ledge { x: number; y: number; side: "L" | "R"; label?: string }
const STAIR_LEDGES: Ledge[] = [
  { x: 366, y: 4380, side: "L", label: "Dojo floor" },
  { x: 710, y: 4080, side: "R" },
  { x: 400, y: 3840, side: "L" },
  { x: 695, y: 3570, side: "R" },
  { x: 396, y: 3300, side: "L" },
  { x: 690, y: 3030, side: "R" },
  { x: 415, y: 2790, side: "L" },
  { x: 710, y: 2460, side: "R" },
  { x: 455, y: 2237, side: "L", label: "High Table landing" }, // TOP FLIGHT — was missing
];

/** A derived flight: climbing direction, endpoints, tread count, and the ledge that caps it. */
export interface Flight {
  index: number;
  dir: "toR" | "toL"; // climbing direction; increasing x = toR
  from: { x: number; y: number };
  to: { x: number; y: number }; // the ledge at the top of the flight
  treads: number;
}

/** Build flights between consecutive ledges (climbing order); tread count from the measured pitch.
 *  ASSERTS the switchback — two consecutive flights running the same way is a bug, so it fails loudly. */
function deriveFlights(): Flight[] {
  const flights: Flight[] = [];
  for (let i = 0; i < STAIR_LEDGES.length - 1; i++) {
    const from = STAIR_LEDGES[i]!;
    const to = STAIR_LEDGES[i + 1]!;
    const dir: "toR" | "toL" = to.x >= from.x ? "toR" : "toL";
    const treads = Math.max(1, Math.round(Math.abs(to.x - from.x) / STEP_RUN_PX));
    if (i > 0 && flights[i - 1]!.dir === dir) {
      console.error(
        `[StairClimber] switchback broken: flights ${i - 1} and ${i} both run ${dir} — check STAIR_LEDGES`,
      );
    }
    flights.push({ index: i, dir, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, treads });
  }
  return flights;
}

export const STAIR_FLIGHTS: Flight[] = deriveFlights();

/** The climb path: one waypoint per TREAD (feet land ON the tread top), plus the LEDGE capping each
 *  flight (a ledge is a step). Positions as % of the map so they survive any rescale. */
export const CLIMB_WAYPOINTS: Waypoint[] = (() => {
  const wp: Waypoint[] = [
    { x: (STAIR_LEDGES[0]!.x / MAP_W) * 100, y: (STAIR_LEDGES[0]!.y / MAP_H) * 100, landing: true, label: STAIR_LEDGES[0]!.label },
  ];
  for (const f of STAIR_FLIGHTS) {
    for (let k = 1; k <= f.treads; k++) {
      const t = k / f.treads;
      const isLedge = k === f.treads;
      wp.push({
        x: ((f.from.x + (f.to.x - f.from.x) * t) / MAP_W) * 100,
        y: ((f.from.y + (f.to.y - f.from.y) * t) / MAP_H) * 100,
        landing: isLedge,
        label: isLedge ? STAIR_LEDGES[f.index + 1]!.label : undefined,
      });
    }
  }
  return wp;
})();

// Dev report (client): per-flight direction, tread count, ledge position (px + %), plus the total.
if (typeof window !== "undefined") {
  const total = STAIR_FLIGHTS.reduce((n, f) => n + f.treads, 0);
  console.info(
    `[StairClimber] ${STAIR_FLIGHTS.length} flights, ${total} treads`,
    STAIR_FLIGHTS.map((f) => {
      const L = STAIR_LEDGES[f.index + 1]!;
      return { flight: f.index, dir: f.dir, treads: f.treads, ledge: `${L.x},${L.y} (${((L.x / MAP_W) * 100).toFixed(1)}%,${((L.y / MAP_H) * 100).toFixed(1)}%)` };
    }),
  );
}

// ── SLOT PIECES — the FRONT rail + newel-post layer the avatar walks BEHIND ──
// Positions are EXACT map placements from public/foxpit/map/slot_placement.json (x,y = sprite
// TOP-LEFT on the 1620x4500 canvas, identical to tower_map_clean.png). Rendered as % so they scale
// with the map. Z-model: map art (baked back rails) < AVATAR (z5) < RAILS < POSTS — so the avatar
// tucks into the slot: in front of the baked back rail, behind the front rail, behind the posts.
const SHEET_W = 1620;
const SHEET_H = 4500;

type SlotSprite = { file: string; x: number; y: number; w: number };
const SLOT_SPRITES: SlotSprite[] = [
  { file: "post_01.png", x: 473, y: 1025, w: 36 },
  { file: "post_02.png", x: 718, y: 1030, w: 36 },
  { file: "piece_01.png", x: 548, y: 1087, w: 99 },
  { file: "post_03.png", x: 805, y: 1492, w: 36 },
  { file: "rail_01.png", x: 587, y: 1564, w: 169 },
  { file: "post_04.png", x: 767, y: 1854, w: 37 },
  { file: "post_05.png", x: 851, y: 1854, w: 37 },
  { file: "rail_02.png", x: 909, y: 1895, w: 173 },
  { file: "rail_03.png", x: 1122, y: 1897, w: 200 },
  { file: "rail_04.png", x: 1359, y: 1900, w: 197 },
  { file: "rail_05.png", x: 1172, y: 2087, w: 221 },
  { file: "post_06.png", x: 805, y: 2092, w: 36 },
  { file: "rail_06.png", x: 882, y: 2093, w: 255 },
  { file: "rail_07.png", x: 1431, y: 2125, w: 187 },
  { file: "rail_08.png", x: 1152, y: 2348, w: 182 },
  { file: "post_07.png", x: 1460, y: 2354, w: 37 },
  { file: "post_08.png", x: 1070, y: 2407, w: 36 },
  { file: "rail_09.png", x: 1152, y: 2546, w: 200 },
  { file: "post_09.png", x: 1040, y: 2675, w: 37 },
  { file: "post_10.png", x: 1346, y: 2898, w: 34 },
  { file: "post_11.png", x: 996, y: 2905, w: 36 },
  { file: "rail_10.png", x: 1084, y: 2957, w: 181 },
  { file: "post_12.png", x: 1162, y: 3197, w: 35 },
  { file: "rail_11.png", x: 927, y: 3244, w: 154 },
  { file: "post_13.png", x: 1272, y: 3421, w: 36 },
  { file: "post_14.png", x: 989, y: 3439, w: 36 },
  { file: "rail_12.png", x: 1046, y: 3482, w: 200 },
  { file: "post_15.png", x: 1284, y: 3723, w: 39 },
  { file: "rail_13.png", x: 1055, y: 3779, w: 163 },
  { file: "post_16.png", x: 1338, y: 3971, w: 37 },
  { file: "post_17.png", x: 1028, y: 3988, w: 38 },
  { file: "rail_14.png", x: 1111, y: 4038, w: 212 },
  { file: "post_18.png", x: 954, y: 4234, w: 36 },
  { file: "rail_15.png", x: 1080, y: 4264, w: 163 },
];

/** Front rail + newel-post SLOT layer, placed at their exact map coords. Posts paint on top of the
 *  rails; both above the avatar so it walks in the slot. */
export function SlotPieces() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      {SLOT_SPRITES.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.file}
          src={`/foxpit/map/stair_pieces/${s.file}`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${(s.x / SHEET_W) * 100}%`,
            top: `${(s.y / SHEET_H) * 100}%`,
            width: `${(s.w / SHEET_W) * 100}%`,
            height: "auto",
            zIndex: s.file.startsWith("post") ? 2 : 1, // posts on top of rails
            pointerEvents: "none",
          }}
        />
      ))}
    </div>
  );
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
    <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none" }}>
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
