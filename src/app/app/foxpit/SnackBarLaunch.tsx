"use client";

/**
 * SNACK BAR launcher — opens Boss Snack Attack (the approved single-file build served at
 * /foxpit/snack/) in a full-screen overlay iframe, with a close button to return.
 *
 * Reachable as a reward: from the Dojo LOCKER ROOM and from the WINNER'S LOUNGE. The lounge's
 * upstairs locker isn't built yet, so this is the interim door in — same game, one shared launcher.
 * The game itself is untouched (served as-is); this only mounts it and lets you step back out.
 */
import { useState } from "react";

const BRASS = "#C8A24B";
const SNACK_URL = "/foxpit/snack/";

export function SnackBarLaunch({
  label = "Snack Bar",
  sub,
  style,
  className,
}: {
  label?: string;
  sub?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          borderRadius: 12,
          border: `1.5px solid ${BRASS}`,
          background: "rgba(200,162,75,.12)",
          color: BRASS,
          padding: "12px 16px",
          fontWeight: 800,
          cursor: "pointer",
          ...style,
        }}
      >
        <span style={{ fontSize: 20 }}>🍩</span>
        <span style={{ flex: 1, textAlign: "left" }}>
          {label}
          {sub && (
            <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted, #94A3B4)" }}>{sub}</span>
          )}
        </span>
        <span style={{ opacity: 0.8 }}>›</span>
      </button>

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
    </>
  );
}
