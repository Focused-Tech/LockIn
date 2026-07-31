"use client";

/**
 * SNACK BAR PHONE — the single entry point to Boss Snack Attack, in BOTH the Dojo locker room and
 * the Winner's Lounge (one shared component, one gate function — never two code paths).
 *
 * A room-service phone prop that sits on the shelf, always visible: DARK when the coin gate is closed
 * (a player who can still afford a seat doesn't get to farm), LIT when it opens. Tapping a dark phone
 * explains why; tapping a lit phone picks it up and orders — opening the game (served as-is at
 * /foxpit/snack/) in a full-screen overlay. The game itself is byte-frozen; this is access only.
 */
import { useState } from "react";
import type { FoxPitRoomKey } from "@/lib/foxpit";
import { snackBarUnlocked, SNACK_CLOSED_REASON } from "@/lib/foxpit/snackGate";

const BRASS = "#C8A24B";
const SNACK_URL = "/foxpit/snack/";

export function SnackBarPhone({
  coins,
  unlockedRooms,
  bossFoxBeaten,
  style,
  className,
}: {
  coins: number;
  unlockedRooms: FoxPitRoomKey[];
  bossFoxBeaten: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const lit = snackBarUnlocked({ coins, unlockedRooms, bossFoxBeaten });
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false); // brief "kitchen's closed" on a dark tap

  const tap = () => {
    if (lit) {
      setOpen(true);
    } else {
      setNudge(true);
      window.setTimeout(() => setNudge(false), 2600);
    }
  };

  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <button
        type="button"
        data-snackphone
        data-lit={lit}
        onClick={tap}
        aria-label={lit ? "Snack Bar — room service, tap to order" : "Snack Bar phone (kitchen's closed)"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          borderRadius: 12,
          border: `1.5px solid ${lit ? BRASS : "rgba(120,124,132,.45)"}`,
          background: lit ? "rgba(200,162,75,.14)" : "rgba(20,22,28,.6)",
          color: lit ? BRASS : "#6b7a8e",
          padding: "12px 16px",
          cursor: "pointer",
          filter: lit ? "none" : "grayscale(1)",
          opacity: lit ? 1 : 0.72,
          boxShadow: lit ? `0 0 18px 1px rgba(200,162,75,.35)` : "none",
          transition: "opacity .25s, box-shadow .25s, border-color .25s",
        }}
      >
        <span style={{ fontSize: 22, filter: lit ? "none" : "grayscale(1) brightness(.8)" }}>☎️</span>
        <span style={{ flex: 1, textAlign: "left", fontWeight: 800 }}>
          Snack Bar
          <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: lit ? "rgba(200,162,75,.8)" : "#5b6675" }}>
            {lit ? "Room service — pick up to order" : "Kitchen's closed"}
          </span>
        </span>
        <span style={{ opacity: 0.8 }}>{lit ? "›" : "🌙"}</span>
      </button>

      {nudge && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "calc(100% + 8px)",
            margin: "0 auto",
            maxWidth: 320,
            borderRadius: 10,
            border: "1px solid rgba(120,124,132,.4)",
            background: "rgba(3,4,7,.92)",
            color: "#c9d2df",
            padding: "9px 12px",
            fontSize: 12.5,
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          }}
        >
          {SNACK_CLOSED_REASON}
        </div>
      )}

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "#0A0D12" }}>
          <iframe
            src={SNACK_URL}
            title="Boss Snack Attack"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
            allow="autoplay"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close Snack Bar"
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 0px) + 10px)",
              right: 12,
              zIndex: 2,
              width: 40,
              height: 40,
              borderRadius: 999,
              border: `1.5px solid ${BRASS}`,
              background: "rgba(3,4,7,.72)",
              color: BRASS,
              fontSize: 20,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
