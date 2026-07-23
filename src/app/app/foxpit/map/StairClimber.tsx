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
