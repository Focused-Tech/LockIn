"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarRig } from "./AvatarRig";

/**
 * FOX PIT — AVATAR STAIR CLIMB (Phase A).
 *
 * The avatar is a jointed WALK RIG (see AvatarRig) assembled from the 18 limb slices — no flat
 * cutout. Its limbs swing (rotation only) as it walks; facing flips at each switchback turn, and it
 * tucks BEHIND the front rail/newel sprites (SlotPieces, z6) that form each ledge's slot.
 *
 * Position + scale are NOT computed here — they come from AVATAR_SLOTS / AVATAR_SCALE, which the
 * architect calibrates with the ⚙ slot cal tool by dragging the live rig onto the baked reference
 * avatar. Until that JSON is baked, nothing renders on the real climb. The rig's internal joints are
 * a separate calibration (the ⚙ pivots tool).
 */

/** One full stride cycle (ms) while moving — drives the rig's contra-lateral swing phase. */
const STRIDE_MS = 720;
/** Feet sit near the bottom of the rig figure box — anchor the FEET onto the slot, not the box. */
const FOOT_PCT = 95;
/** Avatar gender selects the male or female rig slices; persisted per user later, male for now. */
function avatarGender(): "male" | "female" {
  if (typeof window === "undefined") return "male";
  try { return localStorage.getItem("foxpit.avatar") === "female" ? "female" : "male"; }
  catch { return "male"; }
}
/** Mid-stride phase the slot-cal rig freezes at, to match the baked reference while being dragged. */
const CAL_POSE_PHASE = 0.16;

const MAP_W = 1620;
const MAP_H = 4500;

// ── AVATAR SLOTS — CALIBRATED ON DEVICE, NEVER COMPUTED HERE ─────────────────────────────────────
// tower_map_clean.png carries a BAKED REFERENCE AVATAR (Lobby-stairs landing): it encodes WHERE the
// avatar sits, HOW BIG it is, and the coin-head treatment. Position + scale come ONLY from the
// architect dragging the live rig onto that reference in the ⚙ slot cal tool, then pasting its JSON
// here. Until then AVATAR_SLOTS is empty and NO avatar renders on the real climb — no guessed
// default, no CLIMB_WAYPOINTS fallback.
export interface AvatarSlot { id: number; mapX: number; mapY: number }
/** UNCALIBRATED — rig width as a fraction of the map width (one value, shared by every slot). */
export const AVATAR_SCALE = 0;
/** UNCALIBRATED — paste { slots: [...] } from the ⚙ slot cal tool. */
export const AVATAR_SLOTS: AvatarSlot[] = [];

// ── SLOT PIECES — front rails/posts, positioned by HAND (drag pass), not derived ──
// slot_placement.json holds SLICING ORIGINS (where each piece was parked on the cutting sheet —
// all on empty canvas beside the staircase), NOT map placements. So we NEVER read positions from
// it, and NEVER derive rail positions from the avatar slots (those position the avatar only). Placement
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

const STAIR_REF = "/foxpit/map/tower_staircase_clean.png"; // avatar-free staircase — the slot guide
const devBtn = (on: boolean): React.CSSProperties => ({
  pointerEvents: "auto", border: `1px solid ${on ? "#22C55E" : "#00e5ff"}`, background: "rgba(6,8,12,.92)",
  color: on ? "#22C55E" : "#00e5ff", borderRadius: 8, padding: "5px 9px", fontSize: 12, fontWeight: 800, cursor: "pointer",
});
const slotDump: React.CSSProperties = { height: 56, background: "#0a0c11", color: "#9fe0b0", border: "1px solid #222", borderRadius: 8, fontSize: 10, fontFamily: "ui-monospace, monospace", padding: 8 };

/**
 * The climbing avatar. Position + scale come ONLY from AVATAR_SLOTS / AVATAR_SCALE (calibrated with
 * the ⚙ slot tool). Until those exist, nothing renders here. ⚙ pivots calibrates the rig joints;
 * ⚙ slot places the avatar on the baked reference.
 */
export function StairClimber() {
  const gender = avatarGender();
  const [error, setError] = useState<string | null>(null);
  const [calMode, setCalMode] = useState<"off" | "pivots" | "slot">("off");
  const [pivotJson, setPivotJson] = useState("");

  const slotXY = (s: AvatarSlot) => ({ xPct: (s.mapX / MAP_W) * 100, yPct: (s.mapY / MAP_H) * 100 });
  const hasSlots = AVATAR_SLOTS.length > 0;
  const [pos, setPos] = useState(() => {
    const s0 = AVATAR_SLOTS[0];
    return s0 ? { ...slotXY(s0), facing: 1 as 1 | -1, phase: 0 } : { xPct: 0, yPct: 0, facing: 1 as 1 | -1, phase: 0 };
  });
  const [moving, setMoving] = useState(false);
  const busy = useRef(false);
  const raf = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const seg = useRef(0);

  const stepTo = useCallback((to: number) => {
    const a = AVATAR_SLOTS[to - 1]!, b = AVATAR_SLOTS[to]!;
    const A = { xPct: (a.mapX / MAP_W) * 100, yPct: (a.mapY / MAP_H) * 100 };
    const B = { xPct: (b.mapX / MAP_W) * 100, yPct: (b.mapY / MAP_H) * 100 };
    const facing: 1 | -1 = b.mapX >= a.mapX ? 1 : -1;
    busy.current = true; setMoving(true);
    const dur = Math.max(600, Math.hypot(B.xPct - A.xPct, B.yPct - A.yPct) * 90);
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOut(t);
      const phase = ((now - t0) / STRIDE_MS) % 1; // keeps advancing → visible stride
      setPos({ xPct: A.xPct + (B.xPct - A.xPct) * e, yPct: A.yPct + (B.yPct - A.yPct) * e, facing, phase });
      if (t < 1) raf.current = requestAnimationFrame(frame);
      else { busy.current = false; setMoving(false); seg.current = to; setPos((p) => ({ ...p, phase: 0 })); } // idle pose, not a held mid-stride
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  // Walk the calibrated slots in a loop (needs 2+; a single slot just stands). Paused during cal.
  useEffect(() => {
    if (!hasSlots || AVATAR_SLOTS.length < 2 || calMode !== "off") return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      try {
        if (busy.current) { timer.current = window.setTimeout(tick, 150); return; }
        if (seg.current >= AVATAR_SLOTS.length - 1) {
          seg.current = 0;
          setPos({ ...slotXY(AVATAR_SLOTS[0]!), facing: 1, phase: 0 });
          timer.current = window.setTimeout(tick, 1200);
          return;
        }
        stepTo(seg.current + 1);
        timer.current = window.setTimeout(tick, 700);
      } catch (err) {
        console.error("[StairClimber] climb loop failed", err);
        setError(String(err));
      }
    };
    timer.current = window.setTimeout(tick, 700);
    return () => { alive = false; if (timer.current) window.clearTimeout(timer.current); if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSlots, calMode, stepTo]);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: calMode !== "off" ? "auto" : "none" }}>
      {/* REAL avatar — ONLY once AVATAR_SLOTS is calibrated, and never during a cal mode. */}
      {hasSlots && calMode === "off" && (
        <div style={{ position: "absolute", left: `${pos.xPct}%`, top: `${pos.yPct}%`, width: `${AVATAR_SCALE * 100}%`, transform: `translate(-50%, -${FOOT_PCT}%)`, pointerEvents: "none", zIndex: 5, filter: "drop-shadow(0 4px 4px rgba(0,0,0,.7))" }}>
          <div style={{ animation: moving ? "foxpitClimberBob .5s ease-in-out infinite" : "none" }}>
            <AvatarRig gender={gender} phase={pos.phase} facing={pos.facing} />
          </div>
        </div>
      )}

      {/* ⚙ PIVOTS — rig centred + frozen straight; drag joint dots, copy JSON. */}
      {calMode === "pivots" && (
        <>
          <div style={{ position: "fixed", left: "50%", top: "48%", transform: "translate(-50%,-50%)", width: "42vw", zIndex: 88, pointerEvents: "auto" }}>
            <AvatarRig gender={gender} phase={0} facing={1} cal onJointsChange={(j) => setPivotJson(JSON.stringify(j))} />
          </div>
          <textarea readOnly value={pivotJson} onFocus={(e) => e.currentTarget.select()} style={{ position: "fixed", left: 8, right: 8, bottom: "calc(env(safe-area-inset-bottom,0px) + 12px)", zIndex: 90, pointerEvents: "auto", ...slotDump }} />
        </>
      )}

      {/* ⚙ SLOT — drag the live rig onto the baked reference, scale, drop N slots, copy JSON. */}
      {calMode === "slot" && <AvatarSlotCal gender={gender} />}

      {/* dev toggles */}
      <div style={{ position: "fixed", top: "calc(env(safe-area-inset-top,0px) + 60px)", right: 8, zIndex: 90, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "auto" }}>
        <button onClick={() => setCalMode((m) => (m === "slot" ? "off" : "slot"))} style={devBtn(calMode === "slot")}>{calMode === "slot" ? "✓ slot" : "⚙ slot"}</button>
        <button onClick={() => setCalMode((m) => (m === "pivots" ? "off" : "pivots"))} style={devBtn(calMode === "pivots")}>{calMode === "pivots" ? "✓ pivots" : "⚙ pivots"}</button>
      </div>

      {error && (
        <div style={{ position: "absolute", left: 8, right: 8, top: "calc(env(safe-area-inset-top,0px) + 100px)", zIndex: 9, pointerEvents: "none", background: "rgba(120,0,0,.9)", color: "#fff", borderRadius: 8, padding: 10, fontSize: 12 }}>
          Climb error: {error}
        </div>
      )}
    </div>
  );
}

/**
 * AVATAR-SLOT CAL — drag the live 18-piece rig (50% opacity, so the baked reference shows through)
 * onto its spot on the map; the avatar-free staircase overlay (STAIR_REF) marks where the slots land.
 * Corner handle scales uniformly (one scale for all slots). "Add slot" drops a numbered slot at the
 * current spot (N, no cap; tap a dot to delete). Emits { avatarScale, slots } to paste back + bake.
 */
function AvatarSlotCal({ gender }: { gender: "male" | "female" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(AVATAR_SCALE > 0 ? AVATAR_SCALE : 0.09);
  const [cur, setCur] = useState({ mapX: 760, mapY: 3480 });
  const [slots, setSlots] = useState<AvatarSlot[]>(AVATAR_SLOTS.length ? AVATAR_SLOTS.map((s) => ({ ...s })) : []);
  const idRef = useRef(slots.reduce((m, s) => Math.max(m, s.id), 0) + 1);
  const drag = useRef<null | "move" | "scale">(null);

  const toMap = (cx: number, cy: number) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { mapX: Math.round(((cx - r.left) / r.width) * MAP_W), mapY: Math.round(((cy - r.top) / r.height) * MAP_H) };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !rootRef.current) return;
    if (drag.current === "move") { setCur(toMap(e.clientX, e.clientY)); return; }
    const r = rootRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * MAP_W;
    setScale(Math.max(0.03, Math.min(0.28, (Math.abs(px - cur.mapX) * 2) / MAP_W)));
  };
  const json = JSON.stringify({ avatarScale: +scale.toFixed(4), slots });
  const at = (mapX: number, mapY: number) => ({ left: `${(mapX / MAP_W) * 100}%`, top: `${(mapY / MAP_H) * 100}%` });

  return (
    <div ref={rootRef} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "auto" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={STAIR_REF} alt="" aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.4, pointerEvents: "none" }} />

      {slots.map((s) => (
        <button key={s.id} onClick={() => setSlots((xs) => xs.filter((x) => x.id !== s.id))} title="tap to delete"
          style={{ position: "absolute", ...at(s.mapX, s.mapY), transform: "translate(-50%,-50%)", width: 20, height: 20, borderRadius: "50%", background: "rgba(34,197,94,.92)", border: "2px solid #fff", color: "#012", fontSize: 10, fontWeight: 900, zIndex: 9, cursor: "pointer" }}>{s.id}</button>
      ))}

      {/* the live rig at 50% opacity — drag to position */}
      <div onPointerDown={(e) => { drag.current = "move"; (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId); }}
        style={{ position: "absolute", ...at(cur.mapX, cur.mapY), width: `${scale * 100}%`, transform: `translate(-50%, -${FOOT_PCT}%)`, opacity: 0.5, zIndex: 10, cursor: "grab", touchAction: "none" }}>
        <AvatarRig gender={gender} phase={CAL_POSE_PHASE} facing={1} />
        <div onPointerDown={(e) => { e.stopPropagation(); drag.current = "scale"; }} title="drag to scale"
          style={{ position: "absolute", right: -9, top: -9, width: 18, height: 18, borderRadius: 4, background: "#00e5ff", border: "2px solid #fff", zIndex: 11, cursor: "nwse-resize", touchAction: "none" }} />
      </div>

      <div style={{ position: "fixed", left: 8, right: 8, bottom: "calc(env(safe-area-inset-bottom,0px) + 10px)", zIndex: 92, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "auto" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setSlots((s) => [...s, { id: idRef.current++, mapX: cur.mapX, mapY: cur.mapY }])} style={devBtn(false)}>+ Add slot here</button>
          <span style={{ fontSize: 10, color: "#9fe0b0" }}>scale {scale.toFixed(3)} · {slots.length} slot(s) · drag rig to place, corner to size, tap a dot to delete</span>
        </div>
        <textarea readOnly value={json} onFocus={(e) => e.currentTarget.select()} style={slotDump} />
      </div>
    </div>
  );
}
