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
 * copy the dumped JSON back so I can bake it. CLIMB_WAYPOINTS positions the AVATAR ONLY — the
 * post/rail SLOT sprites (SlotPieces, below) are hand-placed via their own ⚙ pieces drag pass.
 */


/**
 * 8-FRAME STAIR-CLIMBING WALK CYCLE (side profile, facing RIGHT), sliced from the 2x4 sheet.
 * Drop the eight sliced frames as /foxpit/walk/avatar-walk-1.png … avatar-walk-8.png and list them
 * here in order (frame 8 loops back to 1). Until they're in, the single mid-stride pose stands in
 * as a 1-frame "cycle". Direction is handled by scaleX (flips at each ledge — the switchback turn),
 * so ALL frames face RIGHT; never mirror the art in the sheet.
 */
const WALK_FRAMES = [
  "/foxpit/avatar-climber.png",
  // "/foxpit/walk/avatar-walk-1.png", "/foxpit/walk/avatar-walk-2.png", … avatar-walk-8.png
];
/** ms per walk frame while the avatar is moving (8 frames ≈ one stride cycle). */
const WALK_FRAME_MS = 90;
/** Feet sit 86.4% down the 611² canvas — anchor the feet, not the box bottom. (Re-measure if the
 *  walk frames use a different canvas/baseline.) */
const FOOT_PCT = 86.4;
/** Avatar box width as a fraction of the map width (tuned on device). */
const AVATAR_W_VW = 15;

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

// ── SLOT PIECES — front rails/posts, positioned by HAND (drag pass), not derived ──
// slot_placement.json holds SLICING ORIGINS (where each piece was parked on the cutting sheet —
// all on empty canvas beside the staircase), NOT map placements. So we NEVER read positions from
// it, and NEVER derive rail positions from CLIMB_WAYPOINTS (those move the avatar only). Placement
// comes from Frank's ⚙ pieces drag pass, baked into SLOT_PLACEMENT below (the single source of
// truth). The file's filenames + intrinsic w/h are still valid — only its coordinates are void.
// Z-model: map art (baked back rails) → AVATAR (z5) → these sprites (z6).
const SHEET_W = 1620;
const SHEET_H = 4500;

interface SlotPieceDef { file: string; w: number; h: number; landing: string }

// Proposed subset to place — ONE rail + two posts per landing (reported before the drag so a wrong
// piece is swapped before 34 sprites get moved). Swap a filename here if it's the wrong piece.
const PROPOSED: SlotPieceDef[] = [
  { file: "rail_06.png", w: 255, h: 183, landing: "Winner's Lounge" },
  { file: "post_04.png", w: 37, h: 184, landing: "Winner's Lounge" },
  { file: "post_05.png", w: 37, h: 184, landing: "Winner's Lounge" },
  { file: "rail_05.png", w: 221, h: 183, landing: "Boss Fox's Suite" },
  { file: "post_03.png", w: 36, h: 178, landing: "Boss Fox's Suite" },
  { file: "post_06.png", w: 36, h: 178, landing: "Boss Fox's Suite" },
  { file: "rail_14.png", w: 212, h: 152, landing: "High Table" },
  { file: "post_08.png", w: 36, h: 177, landing: "High Table" },
  { file: "post_09.png", w: 37, h: 183, landing: "High Table" },
  { file: "rail_03.png", w: 200, h: 135, landing: "Coliseum · upper" },
  { file: "post_10.png", w: 34, h: 177, landing: "Coliseum · upper" },
  { file: "post_11.png", w: 36, h: 178, landing: "Coliseum · upper" },
  { file: "rail_09.png", w: 200, h: 135, landing: "Coliseum · lower" },
  { file: "post_12.png", w: 35, h: 177, landing: "Coliseum · lower" },
  { file: "post_13.png", w: 36, h: 180, landing: "Coliseum · lower" },
  { file: "rail_12.png", w: 200, h: 135, landing: "Lobby" },
  { file: "post_14.png", w: 36, h: 180, landing: "Lobby" },
  { file: "post_16.png", w: 37, h: 188, landing: "Lobby" },
];

// BAKED placement table — paste Frank's ⚙ pieces JSON here to make it the source of truth. Empty
// until then, so NORMAL mode renders a CLEAN map (no misplaced rails). file → {x,y} top-left, map-canvas.
const SLOT_PLACEMENT: Record<string, { x: number; y: number }> = {
  // (empty — awaiting Frank's drag pass)
};

// Rough drag STARTING points near each landing (my eyeball, NOT a final position) so the drags are
/** Front rail/post sprites — the baked SLOT_PLACEMENT, rendered over the tower (path is mapped;
 *  the drag tool has been retired). % = map-canvas coords; the layer never eats pointer events. */
export function SlotPieces() {
  const rendered = PROPOSED.filter((p) => SLOT_PLACEMENT[p.file]);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
      {rendered.map((p) => {
        const pt = SLOT_PLACEMENT[p.file]!;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.file}
            src={`/foxpit/map/stair_pieces/${p.file}`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: `${(pt.x / SHEET_W) * 100}%`,
              top: `${(pt.y / SHEET_H) * 100}%`,
              width: `${(p.w / SHEET_W) * 100}%`,
              height: "auto",
              pointerEvents: "none",
            }}
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
  const [wp] = useState<Waypoint[]>(CLIMB_WAYPOINTS);
  const [pos, setPos] = useState({ x: CLIMB_WAYPOINTS[0]!.x, y: CLIMB_WAYPOINTS[0]!.y, facing: 1, frame: 0 });
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const seg = useRef(0);

  const stepTo = useCallback((to: number, list: Waypoint[]) => {
    const from = to - 1;
    const a = list[from]!;
    const b = list[to]!;
    const facing = b.x >= a.x ? 1 : -1;
    busy.current = true;
    setMoving(true);
    const dur = 260; // per-tread step (the path is now tread-level, ~75 steps)
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      // cycle the walk frames while moving (no-op with the single-pose fallback)
      const walkFrame = WALK_FRAMES.length > 1 ? Math.floor((now - t0) / WALK_FRAME_MS) % WALK_FRAMES.length : 0;
      setPos({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, facing, frame: walkFrame });
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
          setPos({ x: wp[0]!.x, y: wp[0]!.y, facing: 1, frame: 0 });
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
    <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}>
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
          <img src={WALK_FRAMES[pos.frame % WALK_FRAMES.length] ?? WALK_FRAMES[0]} alt="Climbing player" draggable={false} style={{ width: "100%", height: "auto", display: "block", transform: `scaleX(${pos.facing})` }} />
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
