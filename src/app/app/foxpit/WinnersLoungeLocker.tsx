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
import { SnackBarPhone } from "./SnackBarPhone";
import type { FoxPitRoomKey } from "@/lib/foxpit";

const LOCKER_PLATE = "/foxpit/lounge/locker_room_lounge.png";
const CORRIDOR_PLATE = "/foxpit/lounge/elevator_corridor.png";
const BRASS = "#C8A24B";

// §2.2 — the CENTRE locker of the baked bank, as a % box of the 801×1962 plate (measured).
export const LOCKER_BOX = { leftPct: 48.0, topPct: 19.7, widthPct: 14.36, aspect: 115 / 467 };
// §3 — the arch's empty black opening, measured as a % box of the 802×1961 corridor plate.
export const ARCH_OPENING = { leftPct: 31, rightPct: 69, topPct: 26.5, bottomPct: 69 };
// §3.1 — the car scaled to fit INSIDE the arch opening (centred, dome under the arch top).
export const CAR_BOX = { leftPct: 33.5, topPct: 27.8, widthPct: 33, aspect: 618 / 592 };

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
        aspectRatio: `${115} / ${467}`,
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
export function WinnersLoungeLocker({
  coins,
  unlockedRooms,
  bossFoxBeaten,
  onBack,
}: {
  coins: number;
  unlockedRooms: FoxPitRoomKey[];
  bossFoxBeaten: boolean;
  onBack: () => void;
}) {
  const [lockerOpen, setLockerOpen] = useState(false);
  const [atElevator, setAtElevator] = useState(false);

  if (atElevator) return <ElevatorCorridor onBack={() => setAtElevator(false)} />;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "#05070b", overflow: "hidden" }}>
      <Plate src={LOCKER_PLATE} />

      {/* §4 — props on the open marble floor (already flipped in-asset; not flipped again) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/foxpit/lounge/coin_table.png" alt="" draggable={false} style={{ position: "absolute", left: "36%", bottom: "20%", width: "22%", height: "auto", filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/foxpit/lounge/boss_chair.png" alt="" draggable={false} style={{ position: "absolute", left: "55%", bottom: "14%", width: "26%", height: "auto", filter: "drop-shadow(0 12px 22px rgba(0,0,0,.65))" }} />

      {/* §2 — the opening centre locker */}
      <LockerDoor open={lockerOpen} onToggle={() => setLockerOpen((v) => !v)} />

      {/* title */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 12px)", left: 0, right: 0, textAlign: "center", fontSize: 12, letterSpacing: ".3em", color: "#f5e3ac", fontWeight: 800, textShadow: "0 2px 10px #000", pointerEvents: "none" }}>
        WINNER&apos;S LOUNGE · LOCKER ROOM
      </div>

      {/* bottom UI: Snack Bar phone + elevator + back */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "0 22px" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <SnackBarPhone coins={coins} unlockedRooms={unlockedRooms} bossFoxBeaten={bossFoxBeaten} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setAtElevator(true)} style={btn}>Elevator ›</button>
          <button onClick={onBack} style={btn}>‹ Map</button>
        </div>
      </div>
    </div>
  );
}

/** §1.2 + §3 — the elevator corridor: plate with the car composited into the arch recess. */
export function ElevatorCorridor({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "#05070b", overflow: "hidden" }}>
      <Plate src={CORRIDOR_PLATE} />
      {/* §3.1/3.2 — the car sits INSIDE the arch's black opening, so the plate's brass frame stays in
          front (the car never extends over the surrounding panelling). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-elevator-car
        src="/foxpit/lounge/elevator_car.png"
        alt="Elevator car"
        draggable={false}
        style={{ position: "absolute", left: `${CAR_BOX.leftPct}%`, top: `${CAR_BOX.topPct}%`, width: `${CAR_BOX.widthPct}%`, height: "auto" }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", justifyContent: "center" }}>
        <button onClick={onBack} style={btn}>‹ Locker room</button>
      </div>
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
