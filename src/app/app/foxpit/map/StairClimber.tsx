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
// short. The final position is whatever Frank drags to. y per landing group, x per role in the group.
const STAGE_Y = [1150, 1620, 2180, 2820, 3330, 3880]; // winners, suite, hightable, col-upper, col-lower, lobby
const STAGE_X = [640, 480, 820]; // rail, post, post
function stagingPos(i: number): { x: number; y: number } {
  return { x: STAGE_X[i % 3]!, y: (STAGE_Y[Math.floor(i / 3)] ?? 1000) - 90 };
}

/** Front rail/post sprites. NORMAL: render the baked SLOT_PLACEMENT (clean until baked). ⚙ pieces:
 *  drag each proposed sprite onto its landing, nudge 1px, copy the emitted map-canvas JSON. */
export function SlotPieces() {
  const [placing, setPlacing] = useState(false);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>(() => {
    const init: Record<string, { x: number; y: number }> = {};
    PROPOSED.forEach((p, i) => { init[p.file] = SLOT_PLACEMENT[p.file] ?? stagingPos(i); });
    return init;
  });
  const [sel, setSel] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const toCanvas = (clientX: number, clientY: number) => {
    const r = layerRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * SHEET_W, y: ((clientY - r.top) / r.height) * SHEET_H };
  };
  const onDown = (file: string) => (e: React.PointerEvent<HTMLImageElement>) => {
    e.stopPropagation();
    setSel(file);
    const c = toCanvas(e.clientX, e.clientY);
    const p = pos[file]!;
    grab.current = { dx: c.x - p.x, dy: c.y - p.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPMove = (file: string) => (e: React.PointerEvent) => {
    if (sel !== file || !grab.current) return;
    const c = toCanvas(e.clientX, e.clientY);
    setPos((prev) => ({ ...prev, [file]: { x: Math.round(c.x - grab.current!.dx), y: Math.round(c.y - grab.current!.dy) } }));
  };
  const onUp = () => { grab.current = null; };
  const nudge = (dx: number, dy: number) => {
    if (!sel) return;
    setPos((prev) => ({ ...prev, [sel]: { x: prev[sel]!.x + dx, y: prev[sel]!.y + dy } }));
  };

  const emitJson = JSON.stringify(PROPOSED.map((p) => ({ file: p.file, x: pos[p.file]!.x, y: pos[p.file]!.y })));
  // Normal mode shows ONLY baked pieces (clean until Frank bakes); place mode shows all proposals.
  const rendered = placing ? PROPOSED : PROPOSED.filter((p) => SLOT_PLACEMENT[p.file]);

  return (
    <>
      {/* sprite layer — absolute over the tower so % = map-canvas coords. Layer ignores pointers;
          each piece opts in only while placing, so empty-space touches still pan/scroll the map. */}
      <div ref={layerRef} aria-hidden style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}>
        {rendered.map((p) => {
          const pt = pos[p.file]!;
          const on = placing && sel === p.file;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.file}
              src={`/foxpit/map/stair_pieces/${p.file}`}
              alt=""
              draggable={false}
              onPointerDown={placing ? onDown(p.file) : undefined}
              onPointerMove={placing ? onPMove(p.file) : undefined}
              onPointerUp={placing ? onUp : undefined}
              onTouchStart={placing ? (e) => e.stopPropagation() : undefined}
              style={{
                position: "absolute",
                left: `${(pt.x / SHEET_W) * 100}%`,
                top: `${(pt.y / SHEET_H) * 100}%`,
                width: `${(p.w / SHEET_W) * 100}%`,
                height: "auto",
                pointerEvents: placing ? "auto" : "none",
                cursor: placing ? "grab" : "default",
                touchAction: "none",
                outline: on ? "2px solid #00e5ff" : "none",
                filter: on ? "drop-shadow(0 0 6px #00e5ff)" : "none",
              }}
            />
          );
        })}
      </div>

      {/* ⚙ pieces toggle (fixed to the viewport) */}
      <button
        onClick={() => setPlacing((v) => !v)}
        style={{ position: "fixed", top: "calc(env(safe-area-inset-top,0px) + 108px)", right: 8, zIndex: 90, border: "1px solid #00e5ff", background: "rgba(6,8,12,.92)", color: "#00e5ff", borderRadius: 8, padding: "5px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
      >
        {placing ? "✓ pieces" : "⚙ pieces"}
      </button>

      {placing && (
        <div style={{ position: "fixed", left: 8, right: 8, bottom: "calc(env(safe-area-inset-bottom,0px) + 10px)", zIndex: 90, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#cfe", background: "rgba(6,8,12,.85)", borderRadius: 8, padding: "4px 8px" }}>
            <span style={{ color: "#00e5ff", fontWeight: 800 }}>{sel ?? "tap a piece"}</span>
            {sel && <span>x {pos[sel]!.x} · y {pos[sel]!.y}</span>}
            <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {([["←", -1, 0], ["→", 1, 0], ["↑", 0, -1], ["↓", 0, 1]] as const).map(([g, dx, dy]) => (
                <button key={g} onClick={() => nudge(dx, dy)} disabled={!sel} style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #00e5ff", background: "rgba(6,8,12,.92)", color: "#00e5ff", fontSize: 14, fontWeight: 800, cursor: sel ? "pointer" : "not-allowed" }}>{g}</button>
              ))}
            </span>
          </div>
          <textarea readOnly value={emitJson} onFocus={(e) => e.currentTarget.select()} style={{ height: 52, background: "#0a0c11", color: "#9fe0b0", border: "1px solid #222", borderRadius: 8, fontSize: 10, fontFamily: "ui-monospace, monospace", padding: 6 }} />
        </div>
      )}
    </>
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
    const dur = 260; // per-tread step (the path is now tread-level, ~75 steps)
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
        timer.current = window.setTimeout(tick, 260 + 90);
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
              onTouchStart={(e) => e.stopPropagation()}
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
