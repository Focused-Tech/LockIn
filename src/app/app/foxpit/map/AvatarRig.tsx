"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";

/**
 * AVATAR WALK RIG — the climbing avatar, assembled from the 18 limb slices in
 * public/foxpit/cutouts/avatar_rig/ (9 per gender). No baked figure: each limb is pinned by its
 * PROXIMAL joint to a pivot and rotated for the walk (rotation only, no new art). The head is a
 * DRAWN gold-coin placeholder (no head slice exists) until the user avatar badge renders.
 *
 * PIVOTS: brass-cap centroids in _rig_index.json are CANDIDATES only. The joints below are a
 * first-pass guess; the architect refines them with the built-in pivot cal tool (drag each dot,
 * copy the emitted JSON, and it gets baked into JOINTS). Blind pivots are a known failure here.
 *
 * Position + scale come from the parent (AVATAR_SLOTS / AVATAR_SCALE, calibrated) — this component only
 * renders the figure for a given walk `phase` + `facing`.
 */

// Figure box in source-plate pixels (1056x1504). Pieces are placed inside it by pinning their
// proximal cap to a JOINT; % of this box drives the on-screen layout.
const FIG = { x0: 285, y0: 270, w: 215, h: 430 };
export const RIG_ASPECT = FIG.w / FIG.h;

type Gender = "male" | "female";
type Piece = {
  file: string;
  w: number;
  h: number;
  prox: { x: number; y: number }; // proximal-cap offset in piece-local px (the rotation pivot)
  joint: string; // key into JOINTS — where the pivot is pinned in the figure
  z: number; // paint order (item 4)
  swing: (s: number) => number; // walk rotation in degrees, s = sin(2*pi*phase)
};

// First-pass joints (plate px, figure facing RIGHT). Editable via the pivot cal tool.
const JOINTS: Record<string, { x: number; y: number }> = {
  torso: { x: 323, y: 369 }, // torso top cap anchor (no rotation)
  neck: { x: 337, y: 300 }, // coin-head centre
  shoulderN: { x: 360, y: 360 },
  shoulderF: { x: 318, y: 360 },
  elbowN: { x: 348, y: 432 },
  elbowF: { x: 330, y: 430 },
  hipN: { x: 348, y: 505 },
  hipF: { x: 330, y: 505 },
  kneeN: { x: 360, y: 578 },
  kneeF: { x: 320, y: 578 },
};

// Contra-lateral stride (rotation only). s = sin(2*pi*phase). Thighs scissor opposite; the knee
// bends on whichever leg is swinging BACK, so the bent leg ALTERNATES each step. Arms swing opposite
// their same-side leg, visibly. Amplitudes are set to read on a phone at render scale (verify in a
// device screenshot post-calibration, per the spec).
const legN = (s: number) => 20 * s;
const legF = (s: number) => -20 * s;
const shinN = (s: number) => -46 * Math.max(0, -s); // near knee bends when the near thigh is back
const shinF = (s: number) => -46 * Math.max(0, s); // far knee bends when the far thigh is back
const armN = (s: number) => -24 * s; // opposite the near leg
const armF = (s: number) => 24 * s;
const farmN = (s: number) => -12 - 14 * Math.max(0, -s);
const farmF = (s: number) => -12 - 14 * Math.max(0, s);
const still = () => 0;

// Paint order back->front (item 4): far thigh, far shin, far upperarm, far forearm, torso,
// [coin head], near thigh, near shin, near upperarm, near forearm.
function pieces(g: Gender): Piece[] {
  const p = g === "male" ? "m" : "f";
  // proximal caps (piece-local px) picked as the top brass-cap; single-cap pieces estimate the top.
  const M = {
    torso: { w: 72, h: 158, prox: { x: 22, y: 39 } },
    uarm_near: { w: 34, h: 113, prox: { x: 14, y: 6 } },
    farm_near: { w: 33, h: 136, prox: { x: 15, y: 7 } },
    thigh_near: { w: 93, h: 86, prox: { x: 15, y: 17 } },
    shin_near: { w: 63, h: 104, prox: { x: 15, y: 5 } },
    uarm_far: { w: 38, h: 109, prox: { x: 13, y: 6 } },
    farm_far: { w: 48, h: 139, prox: { x: 30, y: 7 } },
    thigh_far: { w: 33, h: 96, prox: { x: 14, y: 5 } },
    shin_far: { w: 58, h: 107, prox: { x: 15, y: 6 } },
  };
  const F = {
    torso: { w: 63, h: 145, prox: { x: 25, y: 22 } },
    uarm_near: { w: 38, h: 111, prox: { x: 14, y: 5 } },
    farm_near: { w: 32, h: 138, prox: { x: 16, y: 8 } },
    thigh_near: { w: 82, h: 103, prox: { x: 18, y: 18 } },
    shin_near: { w: 55, h: 115, prox: { x: 15, y: 11 } },
    uarm_far: { w: 35, h: 111, prox: { x: 16, y: 6 } },
    farm_far: { w: 54, h: 141, prox: { x: 31, y: 7 } },
    thigh_far: { w: 35, h: 109, prox: { x: 16, y: 19 } },
    shin_far: { w: 51, h: 111, prox: { x: 15, y: 6 } },
  };
  const D = g === "male" ? M : F;
  const mk = (key: keyof typeof M, joint: string, z: number, swing: (s: number) => number): Piece => ({
    file: `${p}_${key}.png`,
    w: D[key].w,
    h: D[key].h,
    prox: D[key].prox,
    joint,
    z,
    swing,
  });
  return [
    mk("thigh_far", "hipF", 1, legF),
    mk("shin_far", "kneeF", 2, shinF),
    mk("uarm_far", "shoulderF", 3, armF),
    mk("farm_far", "elbowF", 4, farmF),
    mk("torso", "torso", 5, still),
    // coin head = z 6 (drawn separately)
    mk("thigh_near", "hipN", 7, legN),
    mk("shin_near", "kneeN", 8, shinN),
    mk("uarm_near", "shoulderN", 9, armN),
    mk("farm_near", "elbowN", 10, farmN),
  ];
}

function pct(px: number, span: number, origin: number) {
  return ((px - origin) / span) * 100;
}

export function AvatarRig({
  gender = "male",
  phase = 0,
  facing = 1,
  cal = false,
  onJointsChange,
}: {
  gender?: Gender;
  phase?: number;
  facing?: 1 | -1;
  cal?: boolean; // pivot cal tool: freeze the walk, show draggable pivot dots + JSON
  onJointsChange?: (j: Record<string, { x: number; y: number }>) => void;
}) {
  const list = pieces(gender);
  // Pose comes from `phase` in every mode (pivot cal passes 0 for a straight pose; slot cal passes a
  // mid-stride phase so the rig matches the baked reference while it's dragged onto it).
  const s = Math.sin(phase * Math.PI * 2);
  const [joints, setJoints] = useState(JOINTS);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);

  const toPlate = (clientX: number, clientY: number) => {
    const r = rootRef.current!.getBoundingClientRect();
    return {
      x: Math.round(FIG.x0 + ((clientX - r.left) / r.width) * FIG.w),
      y: Math.round(FIG.y0 + ((clientY - r.top) / r.height) * FIG.h),
    };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!cal || !drag.current) return;
    const pt = toPlate(e.clientX, e.clientY);
    setJoints((prev) => {
      const next = { ...prev, [drag.current!]: pt };
      onJointsChange?.(next);
      return next;
    });
  };

  const coin = joints.neck!;
  const coinD = 62; // plate px

  return (
    <div
      ref={rootRef}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${FIG.w} / ${FIG.h}`,
        transform: `scaleX(${facing})`,
        pointerEvents: cal ? "auto" : "none",
      }}
    >
      {list.map((pc) => {
        const j = joints[pc.joint]!;
        return (
          <img
            key={pc.file}
            src={`/foxpit/cutouts/avatar_rig/${pc.file}`}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: `${pct(j.x - pc.prox.x, FIG.w, FIG.x0)}%`,
              top: `${pct(j.y - pc.prox.y, FIG.h, FIG.y0)}%`,
              width: `${(pc.w / FIG.w) * 100}%`,
              height: "auto",
              zIndex: pc.z,
              transformOrigin: `${(pc.prox.x / pc.w) * 100}% ${(pc.prox.y / pc.h) * 100}%`,
              transform: `rotate(${pc.swing(s)}deg)`,
            }}
          />
        );
      })}

      {/* HEAD SLOT — a DRAWN gold-coin placeholder (z 6: over torso, under near limbs). No head
          slice exists; sourced only from tokens, never another asset. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: `${pct(coin.x - coinD / 2, FIG.w, FIG.x0)}%`,
          top: `${pct(coin.y - coinD / 2, FIG.h, FIG.y0)}%`,
          width: `${(coinD / FIG.w) * 100}%`,
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          zIndex: 6,
          background: "radial-gradient(circle at 42% 38%, #f3d98a 0%, #d9a441 46%, #b9822f 78%, #8a5f1f 100%)",
          boxShadow: "inset 0 0 0 2px rgba(90,60,15,.85), 0 2px 6px rgba(0,0,0,.55)",
        }}
      >
        <div style={{ position: "absolute", inset: "18%", borderRadius: "50%", background: "radial-gradient(circle at 42% 38%, #ffe9ad, #e6bd5c 70%, #caa043)" }} />
      </div>

      {/* pivot cal: draggable dot per joint + live JSON (dev). Same pattern as the stair waypoints. */}
      {cal && (
        <>
          {Object.entries(joints).map(([k, j]) => (
            <div
              key={k}
              onPointerDown={(e) => {
                drag.current = k;
                e.stopPropagation();
              }}
              title={k}
              style={{
                position: "absolute",
                left: `${pct(j.x, FIG.w, FIG.x0)}%`,
                top: `${pct(j.y, FIG.h, FIG.y0)}%`,
                transform: `translate(-50%,-50%) scaleX(${facing})`,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: k === "neck" ? "#d9a441" : "rgba(0,229,255,.95)",
                border: "2px solid #fff",
                zIndex: 20,
                cursor: "grab",
                touchAction: "none",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Serialize the current joints for baking back into JOINTS. */
export function jointsJson(j: Record<string, { x: number; y: number }>) {
  return JSON.stringify(j);
}
