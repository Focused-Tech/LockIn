"use client";

/* eslint-disable @next/next/no-img-element */

/**
 * AVATAR WALK RIG — assembled from the 18 limb slices (9 per gender) with FORWARD KINEMATICS:
 * each leg is thigh→shin(+shoe), each arm is upperarm→forearm(+hand), joined at the brass caps
 * (hip/knee/shoulder/elbow). The lower bone hangs off its parent's DISTAL cap and inherits the
 * parent's rotation, so the limb stays connected — no detached/third leg. Head = a DRAWN gold coin
 * (no head slice). Rotation only, no new art. Position + scale come from the parent (StairClimber).
 */

// Figure box (local px). Skeleton anchors + piece caps live in this space; % of it drives layout.
const FIG = { w: 220, h: 440 };
export const RIG_ASPECT = FIG.w / FIG.h;

type Gender = "male" | "female";
type Cap = { x: number; y: number };
type Piece = { file: string; w: number; h: number; prox: Cap; dist: Cap };

// Skeleton anchors in FIG coords (figure faces RIGHT). Near side = viewer side (drawn last).
const SK = {
  head: { x: 110, y: 66 }, // coin centre
  torso: { x: 74, y: 92 }, // torso top-left
  shoulderN: { x: 126, y: 104 },
  shoulderF: { x: 98, y: 106 },
  hipN: { x: 118, y: 250 },
  hipF: { x: 104, y: 252 },
};

// Per-gender pieces: prox = joint toward the body (rotation pivot), dist = joint the child hangs on.
// Values are piece-local px, read off the slices' brass caps (single-cap pieces estimate the far end).
function rigPieces(g: Gender): Record<string, Piece> {
  const mk = (file: string, w: number, h: number, prox: Cap, dist: Cap): Piece => ({ file: `${g === "male" ? "m" : "f"}_${file}.png`, w, h, prox, dist });
  if (g === "male") {
    return {
      torso: mk("torso", 72, 158, { x: 24, y: 30 }, { x: 40, y: 150 }),
      thighN: mk("thigh_near", 93, 86, { x: 16, y: 18 }, { x: 78, y: 66 }),
      shinN: mk("shin_near", 63, 104, { x: 15, y: 6 }, { x: 46, y: 98 }),
      thighF: mk("thigh_far", 33, 96, { x: 14, y: 6 }, { x: 16, y: 88 }),
      shinF: mk("shin_far", 58, 107, { x: 15, y: 6 }, { x: 42, y: 100 }),
      uarmN: mk("upperarm_near", 34, 113, { x: 15, y: 7 }, { x: 18, y: 106 }),
      farmN: mk("forearm_near", 33, 136, { x: 15, y: 8 }, { x: 20, y: 122 }),
      uarmF: mk("upperarm_far", 38, 109, { x: 14, y: 7 }, { x: 22, y: 102 }),
      farmF: mk("forearm_far", 48, 139, { x: 30, y: 8 }, { x: 30, y: 126 }),
    };
  }
  return {
    torso: mk("torso", 63, 145, { x: 26, y: 24 }, { x: 34, y: 138 }),
    thighN: mk("thigh_near", 82, 103, { x: 18, y: 18 }, { x: 66, y: 88 }),
    shinN: mk("shin_near", 55, 115, { x: 16, y: 10 }, { x: 40, y: 108 }),
    thighF: mk("thigh_far", 35, 109, { x: 16, y: 18 }, { x: 16, y: 100 }),
    shinF: mk("shin_far", 51, 111, { x: 15, y: 6 }, { x: 38, y: 104 }),
    uarmN: mk("upperarm_near", 38, 111, { x: 14, y: 6 }, { x: 20, y: 104 }),
    farmN: mk("forearm_near", 32, 138, { x: 16, y: 8 }, { x: 18, y: 124 }),
    uarmF: mk("upperarm_far", 35, 111, { x: 16, y: 6 }, { x: 20, y: 104 }),
    farmF: mk("forearm_far", 54, 141, { x: 31, y: 8 }, { x: 30, y: 128 }),
  };
}

const rot = (x: number, y: number, deg: number) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
};

type Placed = { p: Piece; at: Cap; angle: number; z: number };
/** Two-bone chain: upper pinned to `anchor` at upAngle; lower hangs off upper's DIST, rotated by
 *  upAngle+loAngle so it inherits the parent's swing (FK). */
function chain(upper: Piece, lower: Piece, anchor: Cap, upAngle: number, loAngle: number, zUp: number, zLo: number): Placed[] {
  const d = rot(upper.dist.x - upper.prox.x, upper.dist.y - upper.prox.y, upAngle);
  const knee = { x: anchor.x + d.x, y: anchor.y + d.y };
  return [
    { p: upper, at: anchor, angle: upAngle, z: zUp },
    { p: lower, at: knee, angle: upAngle + loAngle, z: zLo },
  ];
}

export function AvatarRig({ gender = "male", phase = 0, facing = 1 }: { gender?: Gender; phase?: number; facing?: 1 | -1 }) {
  const P = rigPieces(gender);
  const s = Math.sin(phase * Math.PI * 2);
  // Stride, rotation only. Thighs scissor opposite; the knee flexes on the leg swinging BACK, so the
  // bent leg ALTERNATES. Arms swing opposite their same-side leg; elbows carry a light constant bend.
  const thighN = 16 * s, thighF = -16 * s;
  const shinN = -38 * Math.max(0, -s), shinF = -38 * Math.max(0, s);
  const uarmN = -18 * s, uarmF = 18 * s;
  const farmN = -16 - 8 * Math.max(0, -s), farmF = -16 - 8 * Math.max(0, s);

  // Paint order back → front (item 4).
  const placed: Placed[] = [
    ...chain(P.thighF!, P.shinF!, SK.hipF, thighF, shinF, 1, 2),
    ...chain(P.uarmF!, P.farmF!, SK.shoulderF, uarmF, farmF, 3, 4),
    { p: P.torso!, at: { x: SK.torso.x + P.torso!.prox.x, y: SK.torso.y + P.torso!.prox.y }, angle: 0, z: 5 },
    ...chain(P.thighN!, P.shinN!, SK.hipN, thighN, shinN, 7, 8),
    ...chain(P.uarmN!, P.farmN!, SK.shoulderN, uarmN, farmN, 9, 10),
  ];

  const coinD = 60;

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${FIG.w} / ${FIG.h}`, transform: `scaleX(${facing})`, pointerEvents: "none" }}>
      {placed.map((pl) => (
        <img
          key={pl.p.file + pl.z}
          src={`/foxpit/cutouts/avatar_rig/${pl.p.file}`}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${((pl.at.x - pl.p.prox.x) / FIG.w) * 100}%`,
            top: `${((pl.at.y - pl.p.prox.y) / FIG.h) * 100}%`,
            width: `${(pl.p.w / FIG.w) * 100}%`,
            height: "auto",
            zIndex: pl.z,
            transformOrigin: `${(pl.p.prox.x / pl.p.w) * 100}% ${(pl.p.prox.y / pl.p.h) * 100}%`,
            transform: `rotate(${pl.angle}deg)`,
          }}
        />
      ))}

      {/* HEAD SLOT — drawn gold coin (z6, over torso, under near limbs). Tokens only, no head art. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: `${((SK.head.x - coinD / 2) / FIG.w) * 100}%`,
          top: `${((SK.head.y - coinD / 2) / FIG.h) * 100}%`,
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
    </div>
  );
}
