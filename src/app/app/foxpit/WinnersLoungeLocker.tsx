"use client";

/**
 * WINNER'S LOUNGE — locker room + elevator corridor (asset drop WINNERS_LOUNGE_ASSETS).
 *
 * §1 The plates go in as FULL-BLEED backdrops (9:22, matched to the device), cover-fit, bottom-anchored
 *    so the bottom quarter (where UI sits) stays visible.
 * §2 The CENTRE locker opens on tap: closed → interior swap + the inner door swings on its LEFT hinge
 *    (rotateY, origin left, perspective on the parent). Interior opacity is tied to the swing so nothing
 *    shows through a shut door.
 * §3 The elevator car composites INTO the arch's empty black recess (behind the plate's brass frame).
 *    The plate already paints the up/down call buttons, so call_buttons.png is redundant (not used).
 * §4 The boss chair + coin table (already flipped in-asset) stand on the open marble floor.
 * §5 parked/window_* are the wrong camera angle — not referenced.
 *
 * Positions are % of the plate; because plate and device are both 9:22, cover-fit maps 1:1. Measured
 * off the plates — fine-tune against the architect's device screenshot.
 */
import { useState } from "react";

const LOCKER_PLATE = "/foxpit/lounge/locker_room_lounge.png";
const CORRIDOR_PLATE = "/foxpit/lounge/elevator_corridor.png";
const BRASS = "#C8A24B";

// ── MEASURED PLATE COORDINATES (px) — from the architect's measurements; NOT eyeballed. ──
// Corridor plate = 802×1961 · Locker plate = 801×1962.
const CORRIDOR_W = 802, CORRIDOR_H = 1961;
const LOCKER_W = 801, LOCKER_H = 1962;
const p = (v: number, dim: number) => `${((v / dim) * 100).toFixed(3)}%`;

// §1 ELEVATOR — arch opening x251→547 (296w), y531→1403 (base 1403), centre x399. The car asset is
// 201×572; ×1.47 = 296×841 (the exact arch width), bottom-aligned to the arch base (top = 1403−841).
export const ARCH_PX = { left: 251, right: 547, top: 531, bottom: 1403 };
export const CAR_PX = { left: 251, top: 557, width: 296, height: 846 }; // ×1.458, bottom = 557+846 = 1403 (arch base / floor line)
export const CAR_SCALE = 1.47;

// §2 FURNITURE — outside the floor-medallion ring (x>613, y>1044) and above the UI safe line
// (y+h<1442). Band ≈188×398. Scaled down to sit inside with breathing room. Already flipped in-asset.
export const FURNITURE_PX = {
  chair: { left: 662, top: 1088, width: 118, height: 137, scale: 0.456 }, // boss_chair 259×301
  table: { left: 642, top: 1256, width: 128, height: 169, scale: 0.612 }, // coin_table 209×276
};
// The centre locker rect (bank base = y700) — furniture must clear it entirely (§2.4).
export const LOCKER_RECT_PX = { left: 384, top: 400, width: 112, height: 300 };
// The overlay box for the opening centre locker, as a % of the plate (bottom aligned to bank base y700).
export const LOCKER_BOX = {
  leftPct: (LOCKER_RECT_PX.left / LOCKER_W) * 100,
  topPct: (LOCKER_RECT_PX.top / LOCKER_H) * 100,
  widthPct: (LOCKER_RECT_PX.width / LOCKER_W) * 100,
  heightPct: (LOCKER_RECT_PX.height / LOCKER_H) * 100,
};

/** Full-bleed 9:22 plate, cover-fit, anchored so the bottom quarter (UI) stays visible (§1.3). */
function Plate({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom" }}
    />
  );
}

/** §2 — the opening centre locker. Three normalised pieces (all 115×467) share ONE box so the swap
 *  never jumps. Tap to toggle. */
export function LockerDoor({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill", display: "block" };
  return (
    <div
      onClick={onToggle}
      data-locker
      style={{
        position: "absolute",
        left: `${LOCKER_BOX.leftPct}%`,
        top: `${LOCKER_BOX.topPct}%`,
        width: `${LOCKER_BOX.widthPct}%`,
        height: `${LOCKER_BOX.heightPct}%`,
        perspective: 700, // §2.3 perspective on the parent
        cursor: "pointer",
      }}
    >
      {/* interior (base) — opacity tied to the swing so it never shows through a shut door (§2.4) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-locker-interior src="/foxpit/lounge/locker_open_interior.png" alt="" draggable={false} style={{ ...fill, opacity: open ? 1 : 0, transition: "opacity .32s ease-out" }} />
      {/* the inner door — swings on the LEFT hinge (§2.3) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-locker-door
        src="/foxpit/lounge/locker_door_inner.png"
        alt=""
        draggable={false}
        style={{ ...fill, transformOrigin: "left center", transform: open ? "rotateY(-105deg)" : "rotateY(0deg)", transition: "transform .32s ease-out", opacity: open ? 1 : 0, backfaceVisibility: "hidden" }}
      />
      {/* the closed front — the shut state; fades out the instant the door starts to open */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img data-locker-closed src="/foxpit/lounge/locker_closed.png" alt="Locker" draggable={false} style={{ ...fill, opacity: open ? 0 : 1, transition: "opacity .12s ease-out" }} />
    </div>
  );
}

/** §1.1 + §2 + §4 — the Winner's Lounge locker room: plate + props + the opening locker + the Snack
 *  Bar phone, plus a way to the elevator corridor and back to the map. */
export function WinnersLoungeLocker({ onBack }: { onBack: () => void }) {
  const [lockerOpen, setLockerOpen] = useState(false);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "#05070b", overflow: "hidden" }}>
      <Plate src={LOCKER_PLATE} />

      {/* §2 — furniture OUTSIDE the crest ring, down and to the right (measured band x>613 / y1044→1442),
          scaled to fit, clearing the locker bank entirely. Already flipped in-asset — not flipped again. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/foxpit/lounge/boss_chair.png" alt="" draggable={false} style={{ position: "absolute", left: p(FURNITURE_PX.chair.left, LOCKER_W), top: p(FURNITURE_PX.chair.top, LOCKER_H), width: p(FURNITURE_PX.chair.width, LOCKER_W), height: p(FURNITURE_PX.chair.height, LOCKER_H), filter: "drop-shadow(0 10px 18px rgba(0,0,0,.65))" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/foxpit/lounge/coin_table.png" alt="" draggable={false} style={{ position: "absolute", left: p(FURNITURE_PX.table.left, LOCKER_W), top: p(FURNITURE_PX.table.top, LOCKER_H), width: p(FURNITURE_PX.table.width, LOCKER_W), height: p(FURNITURE_PX.table.height, LOCKER_H), filter: "drop-shadow(0 10px 16px rgba(0,0,0,.6))" }} />

      {/* §2 — the opening centre locker */}
      <LockerDoor open={lockerOpen} onToggle={() => setLockerOpen((v) => !v)} />

      {/* title — a door off the lounge */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 12px)", left: 0, right: 0, textAlign: "center", fontSize: 12, letterSpacing: ".3em", color: "#f5e3ac", fontWeight: 800, textShadow: "0 2px 10px #000", pointerEvents: "none" }}>
        LOCKER ROOM
      </div>

      {/* leaving returns to the LOUNGE (§3.4) — the Snack Bar + Elevator are lounge controls, not here */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", justifyContent: "center", padding: "0 22px" }}>
        <button onClick={onBack} style={btn}>‹ Lounge</button>
      </div>
    </div>
  );
}

/** The Snack Bar itself — the byte-frozen game, opened full-screen from the lounge. */
export function SnackOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#0A0D12", boxSizing: "border-box", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* iframe fills the (safe-area-padded) box at a definite 100% size, so the game lays out and its
          bottom Rules/Leaders/Order row clears the nav bar. */}
      <iframe
        src="/foxpit/snack-attack.html"
        title="Boss Snack Attack"
        style={{ display: "block", width: "100%", height: "100%", border: "none" }}
        allow="autoplay"
      />
      <button
        onClick={onClose}
        aria-label="Close Snack Bar"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 10px)", right: 12, zIndex: 2, width: 40, height: 40, borderRadius: 999, border: `1.5px solid ${BRASS}`, background: "rgba(3,4,7,.72)", color: BRASS, fontSize: 20, fontWeight: 800, cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}

/** The elevator corridor — the top-floor landing. §1 the lounge is the TOP floor: travel only goes
 *  DOWN (UP is dark + inert). §2 the car STANDS ON THE FLOOR (bottom-anchored at the arch base y1403);
 *  it never rises. On DOWN it descends out of the opening and hands off downward. */
export function ElevatorCorridor({ onBack, onDown }: { onBack: () => void; onDown?: () => void }) {
  // DOWN CALL → hand off to the floor-select RIDE. The car stays put on the floor here; the doors
  // OPEN inside the ride overlay (ElevatorRide's opening frames), you pick a floor, then it travels.
  // No car-slide here — tapping DOWN "calls" the car, it does NOT immediately leave the tower.
  const call = onDown ?? onBack;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "#05070b", overflow: "hidden" }}>
      <Plate src={CORRIDOR_PLATE} />
      {/* §2 — the car STANDS on the floor: bottom-anchored at the arch base y1403 (296×846, ×1.458),
          left x251, ~26px dark under the crown (§2.4). Static — it does not float, rise, or slide away
          (§2.3/1.1). The plate's brass frame stays in front (§2.5). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-elevator-car
        src="/foxpit/lounge/elevator_car.png"
        alt="Elevator car"
        draggable={false}
        style={{
          position: "absolute",
          left: p(CAR_PX.left, CORRIDOR_W),
          top: p(CAR_PX.top, CORRIDOR_H),
          width: p(CAR_PX.width, CORRIDOR_W),
          height: p(CAR_PX.height, CORRIDOR_H),
        }}
      />

      {/* §1.2 — UP call: DARK + INERT (top floor, nothing above). Darkens the plate's painted up arrow.
          Positioned over the brass call plate on the wall right of the arch (up = top arrow). */}
      <button
        data-elevator-up
        disabled
        aria-label="Up (top floor — disabled)"
        style={{ position: "absolute", left: "74.8%", top: "46.2%", width: "6.6%", height: "3%", background: "rgba(3,4,7,.62)", border: "none", borderRadius: 3, cursor: "not-allowed", filter: "grayscale(1)", padding: 0 }}
      />
      {/* §1.3 — DOWN call: the LIVE control, over the plate's painted down arrow (the bottom arrow on
          the brass call plate). Tapping it opens the elevator (floor-select). Gold pulse marks it live. */}
      <button
        data-elevator-down
        aria-label="Call the elevator (down)"
        onClick={call}
        style={{ position: "absolute", left: "74.8%", top: "49.2%", width: "6.6%", height: "3%", background: "rgba(200,162,75,.18)", border: "none", borderRadius: 3, cursor: "pointer", boxShadow: "0 0 0 2px rgba(200,162,75,.6), 0 0 12px rgba(200,162,75,.5)", padding: 0, animation: "foxpitCallPulse 1.5s ease-in-out infinite" }}
      />

      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, letterSpacing: ".12em", color: "rgba(245,227,172,.85)", textShadow: "0 2px 8px #000" }}>Top floor — call the car, then pick a floor ▼</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={call} style={btn}>▼ Call elevator</button>
          <button onClick={onBack} style={btn}>‹ Lounge</button>
        </div>
      </div>
      <style>{`
        @keyframes foxpitCallPulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(200,162,75,.6), 0 0 10px rgba(200,162,75,.45); }
          50% { box-shadow: 0 0 0 2px rgba(200,162,75,.9), 0 0 18px rgba(200,162,75,.75); }
        }
      `}</style>
    </div>
  );
}

const btn: React.CSSProperties = {
  border: `1.5px solid ${BRASS}`,
  background: "rgba(200,162,75,.12)",
  color: "#f5e3ac",
  borderRadius: 12,
  padding: "11px 22px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
