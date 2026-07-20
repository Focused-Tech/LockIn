"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockGlyph } from "@/components/practice/LockGlyph";
import {
  FOXPIT_ROOMS,
  LOBBY_MAP_Y,
  KEY_ASSET,
  MEMBERSHIP_CARD,
  ELEVATOR_UNLOCK_AT,
  getCleared,
  isUnlocked,
  keyLabel,
  roomByKey,
  type FoxPitRoomKey,
} from "@/lib/foxpit";

/**
 * Fox Pit TOWER MAP (background = map-tower.png) — a tall vertical climb with
 * pinch-to-zoom + pan. Floors are slim PLAQUES (the painted room art shows
 * behind them). The header appears on entry and fades out after 4s. The
 * elevator (far left) opens a FLOOR-SELECT panel: the four room cards, each
 * CLEARED or LOCKED, plus the tiered keys you've won.
 */
const pinchDist = (t: React.TouchList) => {
  const a = t[0]!;
  const b = t[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

export function FoxPitMap({ lone = false }: { lone?: boolean }) {
  const router = useRouter();
  const vpRef = useRef<HTMLDivElement>(null);
  const cRef = useRef<HTMLDivElement>(null);
  const [cleared, setCleared] = useState<Set<FoxPitRoomKey>>(new Set());
  const [hud, setHud] = useState(true);
  const [floorSelect, setFloorSelect] = useState(false);
  const [elevatorLocked, setElevatorLocked] = useState(false);
  // Fast-travel elevator activates only once the High Table is CLEARED (beaten),
  // independent of the architect door-unlock override.
  const elevatorUnlocked = cleared.has(ELEVATOR_UNLOCK_AT);

  // pan/zoom (kept in a ref + applied directly to the DOM — no re-render churn)
  const v = useRef({ scale: 1, tx: 0, ty: 0 });
  const g = useRef({
    mode: "none" as "none" | "pan" | "pinch",
    lx: 0,
    ly: 0,
    d0: 0,
    s0: 1,
  });

  const apply = () => {
    const c = cRef.current;
    if (c)
      c.style.transform = `translate3d(${v.current.tx}px, ${v.current.ty}px, 0) scale(${v.current.scale})`;
  };
  const clamp = () => {
    const vp = vpRef.current;
    const c = cRef.current;
    if (!vp || !c) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const cw = c.offsetWidth * v.current.scale;
    const ch = c.offsetHeight * v.current.scale;
    v.current.tx = Math.max(Math.min(0, vw - cw), Math.min(0, v.current.tx));
    v.current.ty = Math.max(Math.min(0, vh - ch), Math.min(0, v.current.ty));
  };

  useEffect(() => {
    setCleared(getCleared());
    // start at the bottom (the Dojo) — you climb up
    requestAnimationFrame(() => {
      const vp = vpRef.current;
      const c = cRef.current;
      if (vp && c) {
        v.current.ty = Math.min(0, vp.clientHeight - c.offsetHeight);
        apply();
      }
    });
    const t = window.setTimeout(() => setHud(false), 4000);
    return () => window.clearTimeout(t);
  }, []);

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length === 1) {
      g.current = { mode: "pan", lx: t[0]!.clientX, ly: t[0]!.clientY, d0: 0, s0: v.current.scale };
    } else if (t.length === 2) {
      const mx = (t[0]!.clientX + t[1]!.clientX) / 2;
      const my = (t[0]!.clientY + t[1]!.clientY) / 2;
      g.current = { mode: "pinch", lx: mx, ly: my, d0: pinchDist(t), s0: v.current.scale };
    }
  };
  const onMove = (e: React.TouchEvent) => {
    const t = e.touches;
    if (g.current.mode === "pan" && t.length === 1) {
      v.current.tx += t[0]!.clientX - g.current.lx;
      v.current.ty += t[0]!.clientY - g.current.ly;
      g.current.lx = t[0]!.clientX;
      g.current.ly = t[0]!.clientY;
      clamp();
      apply();
    } else if (g.current.mode === "pinch" && t.length === 2 && g.current.d0 > 0) {
      const ns = Math.max(1, Math.min(3, g.current.s0 * (pinchDist(t) / g.current.d0)));
      const mx = (t[0]!.clientX + t[1]!.clientX) / 2;
      const my = (t[0]!.clientY + t[1]!.clientY) / 2;
      const rect = vpRef.current!.getBoundingClientRect();
      const px = mx - rect.left;
      const py = my - rect.top;
      const k = ns / v.current.scale;
      v.current.tx = px - (px - v.current.tx) * k;
      v.current.ty = py - (py - v.current.ty) * k;
      v.current.scale = ns;
      clamp();
      apply();
    }
  };
  const onEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) g.current.mode = "none";
    else if (e.touches.length === 1) {
      g.current.mode = "pan";
      g.current.lx = e.touches[0]!.clientX;
      g.current.ly = e.touches[0]!.clientY;
    }
  };

  const enter = (key: FoxPitRoomKey) => router.push(`/app/foxpit/room/${key}`);

  // Membership card → "walk down the stairs" to the Dojo (free practice at the
  // bottom): smoothly pan the tower down to the very bottom.
  const walkDownToPractice = () => {
    const vp = vpRef.current;
    const c = cRef.current;
    if (!vp || !c) return;
    c.style.transition = "transform 1.8s cubic-bezier(.45,.05,.2,1)";
    v.current.tx = 0;
    v.current.ty = Math.min(0, vp.clientHeight - c.offsetHeight);
    apply();
    window.setTimeout(() => {
      if (cRef.current) cRef.current.style.transition = "";
    }, 1900);
  };

  return (
    <div
      ref={vpRef}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#0A0D12",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <div
        ref={cRef}
        style={{ position: "relative", width: "100%", transformOrigin: "0 0", willChange: "transform" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/map-tower.png"
          alt="The Fox Pit tower"
          draggable={false}
          style={{ width: "100%", display: "block" }}
        />

        {/* floor plaques — slim, so the painted room art shows behind them */}
        {FOXPIT_ROOMS.map((r) => {
          const unlocked = lone || isUnlocked(r, cleared);
          const done = cleared.has(r.key);
          const current = unlocked && !done;
          return (
            <button
              key={r.key}
              onClick={() => unlocked && enter(r.key)}
              disabled={!unlocked}
              style={{
                position: "absolute",
                zIndex: 2,
                top: `${r.mapY * 100}%`,
                left: "14%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: "74%",
                padding: "7px 12px",
                borderRadius: 999,
                textAlign: "left",
                cursor: unlocked ? "pointer" : "not-allowed",
                color: "#E7E7EB",
                background: current
                  ? "rgba(20,10,4,.78)"
                  : unlocked
                    ? "rgba(10,13,18,.66)"
                    : "rgba(3,4,7,.7)",
                border: `1.5px solid ${current ? "#FC3E01" : unlocked ? r.accent : "#3a4653"}`,
                boxShadow: current ? "0 0 22px rgba(252,62,1,.5)" : "0 6px 16px rgba(0,0,0,.5)",
                filter: unlocked ? "none" : "grayscale(.5) brightness(.72)",
                animation: current ? "foxpitGlow 2.6s ease-in-out infinite" : "none",
                backdropFilter: "blur(1px)",
              }}
            >
              {!unlocked ? (
                <LockGlyph size={14} />
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1,
                    color: done ? "#22C55E" : current ? "#FC3E01" : r.accent,
                  }}
                >
                  {done ? "✓" : current ? "▸" : "•"}
                </span>
              )}
              <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, letterSpacing: ".03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.name}
              </span>
              {!unlocked && (
                <span style={{ fontSize: 10, color: "#c8a24b", fontWeight: 800, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
                  {keyLabel(r.needsKey!)} KEY
                </span>
              )}
            </button>
          );
        })}

        {/* lobby landmark (street level, a hub — tap to return to the lobby) */}
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{
            position: "absolute",
            zIndex: 2,
            top: `${LOBBY_MAP_Y * 100}%`,
            left: "14%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            cursor: "pointer",
            color: "#d8c79b",
            background: "rgba(10,13,18,.6)",
            border: "1.5px solid rgba(200,162,75,.45)",
          }}
        >
          <span style={{ fontSize: 12 }}>⌂</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 700, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
            The Lobby
          </span>
        </button>

        {/* Practice Here — affixed to the lobby floor (scrolls with the tower); walks down to the Dojo */}
        <button
          onClick={walkDownToPractice}
          aria-label="Practice free at the Dojo"
          style={{
            position: "absolute",
            zIndex: 2,
            top: "72%",
            left: "14%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid rgba(252,62,1,.55)",
            background: "rgba(3,4,7,.82)",
            borderRadius: 12,
            padding: "7px 12px",
            cursor: "pointer",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MEMBERSHIP_CARD} alt="" style={{ width: 36, height: "auto", borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,.6)" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: "#ffb089", letterSpacing: ".05em", lineHeight: 1.1, textAlign: "left" }}>
            Practice
            <br />
            Here ↓
          </span>
        </button>

        {/* elevator (far left) — full-size doors with a center split; locked until the High Table is cleared */}
        <button
          onClick={() => (elevatorUnlocked ? setFloorSelect(true) : setElevatorLocked(true))}
          aria-label="Elevator"
          style={{
            position: "absolute",
            zIndex: 0,
            top: "33%",
            left: "1.5%",
            width: "15%",
            height: "11%",
            transform: "translateY(-50%)",
            borderRadius: 6,
            border: "1px solid rgba(200,162,75,.55)",
            background: "linear-gradient(180deg, rgba(40,34,22,.9), rgba(12,14,20,.92))",
            cursor: "pointer",
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* two elevator doors + the center split line */}
          <div style={{ position: "absolute", inset: 0, display: "flex" }}>
            <div style={{ flex: 1, background: "linear-gradient(90deg, rgba(60,66,84,.55), rgba(28,32,44,.55))", borderRight: "1px solid rgba(200,162,75,.6)" }} />
            <div style={{ flex: 1, background: "linear-gradient(270deg, rgba(60,66,84,.55), rgba(28,32,44,.55))" }} />
          </div>
          {/* label plate */}
          <div style={{ position: "relative", width: "100%", padding: "2px 0", background: "rgba(3,4,7,.74)", color: "#d8c79b", fontSize: 7, fontWeight: 800, letterSpacing: ".05em", textAlign: "center" }}>
            ELEVATOR
          </div>
        </button>
      </div>

      {/* fixed HUD — appears on entry, fades out after 4s */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 110,
          zIndex: 61,
          pointerEvents: "none",
          background: "linear-gradient(180deg,rgba(3,4,7,.92),transparent)",
          opacity: hud ? 1 : 0,
          transition: "opacity 1.1s ease",
        }}
      >
        <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".12em", color: "#E7E7EB" }}>
            {lone ? "CHOOSE AN ARENA" : "THE BOSS JOURNEY"}
          </div>
          <div style={{ fontSize: 12, letterSpacing: ".2em", color: "#C8A24B", fontWeight: 700, marginTop: 2 }}>
            CLIMB THE TOWER
          </div>
        </div>
      </div>

      {/* always-available Lobby button (outside the fading HUD) */}
      <button
        onClick={() => router.push("/app/foxpit")}
        style={{
          position: "fixed",
          top: 16,
          left: 8,
          zIndex: 63,
          border: "1px solid rgba(200,162,75,.5)",
          background: "rgba(3,4,7,.62)",
          color: "#d8c79b",
          borderRadius: 10,
          padding: "8px 11px",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ‹ Lobby
      </button>

      {floorSelect && (
        <FloorSelectPanel
          lone={lone}
          cleared={cleared}
          onClose={() => setFloorSelect(false)}
          onPick={(k) => {
            setFloorSelect(false);
            enter(k);
          }}
        />
      )}

      {elevatorLocked && (
        <div
          onClick={() => setElevatorLocked(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(3,4,7,.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 360,
              borderRadius: 16,
              background: "linear-gradient(180deg,#141821,#0a0d13)",
              border: "2px solid #C8A24B",
              boxShadow: "0 0 40px rgba(200,162,75,.35)",
              padding: 26,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <LockGlyph size={44} />
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "#E7E7EB", marginTop: 8 }}>
              Elevator locked
            </div>
            <div style={{ width: 90, height: 2, margin: "12px auto", background: "linear-gradient(90deg,transparent,#C8A24B,transparent)" }} />
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#c3cedb" }}>
              The elevator stays out of service until you reach{" "}
              <b style={{ color: "#C8A24B" }}>{roomByKey(ELEVATOR_UNLOCK_AT).name}</b>. Climb the
              tower and clear the floors below to unlock fast-travel between them.
            </p>
            <button
              onClick={() => setElevatorLocked(false)}
              style={{
                marginTop: 22,
                border: "1px solid #C8A24B",
                background: "rgba(200,162,75,.15)",
                color: "#ffe",
                borderRadius: 12,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The elevator's floor-select — the four room cards + the tiered keys you've won. */
function FloorSelectPanel({
  lone,
  cleared,
  onClose,
  onPick,
}: {
  lone: boolean;
  cleared: Set<FoxPitRoomKey>;
  onClose: () => void;
  onPick: (k: FoxPitRoomKey) => void;
}) {
  const won = FOXPIT_ROOMS.filter((r) => cleared.has(r.key));
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(3,4,7,.86)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "84px 18px 24px",
        overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".1em", color: "#E7E7EB" }}>
            ELEVATOR · SELECT A FLOOR
          </div>
        </div>

        {/* keys won */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minHeight: 54,
            marginBottom: 16,
            padding: "8px 12px",
            borderRadius: 12,
            background: "rgba(10,13,18,.6)",
            border: "1px solid rgba(200,162,75,.3)",
          }}
        >
          <span style={{ fontSize: 10, letterSpacing: ".16em", color: "#8b98a6", fontWeight: 800 }}>
            KEYS WON
          </span>
          {won.length === 0 ? (
            <span style={{ fontSize: 12, color: "#6b7a8e" }}>None yet — clear a floor to earn its key</span>
          ) : (
            won.map((r) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={r.key}
                src={KEY_ASSET[r.bossArt].src}
                alt={`${r.boss} key`}
                title={`${KEY_ASSET[r.bossArt].tier} · ${r.boss}`}
                style={{ height: 40, width: "auto", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}
              />
            ))
          )}
        </div>

        {/* the four room cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {FOXPIT_ROOMS.map((r) => {
            const unlocked = lone || isUnlocked(r, cleared);
            const done = cleared.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => unlocked && onPick(r.key)}
                disabled={!unlocked}
                style={{
                  position: "relative",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: `2px solid ${done ? "#22C55E" : unlocked ? r.accent : "#3a4653"}`,
                  boxShadow: unlocked ? `0 0 16px ${r.accent}33, 0 8px 20px rgba(0,0,0,.5)` : "none",
                  cursor: unlocked ? "pointer" : "not-allowed",
                  aspectRatio: "3 / 4",
                  background: "#0a0d13",
                  filter: unlocked ? "none" : "grayscale(.6) brightness(.6)",
                  padding: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.roomImg}
                  alt={r.name}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 45%,rgba(3,4,7,.92))" }} />

                {/* won key badge (top-right) */}
                {done && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={KEY_ASSET[r.bossArt].src}
                    alt={`${r.boss} key`}
                    style={{ position: "absolute", top: 8, right: 8, height: 34, width: "auto", filter: "drop-shadow(0 2px 5px #000)" }}
                  />
                )}

                <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, textAlign: "left" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "#E7E7EB", fontWeight: 700 }}>
                    {r.name}
                  </div>
                  {done ? (
                    <div style={{ fontSize: 10, letterSpacing: ".1em", color: "#22C55E", fontWeight: 800, marginTop: 2 }}>
                      ✓ CLEARED
                    </div>
                  ) : unlocked ? (
                    <div style={{ fontSize: 10, letterSpacing: ".1em", color: r.accent, fontWeight: 800, marginTop: 2 }}>
                      ENTER ›
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, letterSpacing: ".06em", color: "#c8a24b", fontWeight: 800, marginTop: 2 }}>
                      <LockGlyph size={11} /> NEEDS {keyLabel(r.needsKey!)} KEY
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            display: "block",
            margin: "20px auto 0",
            border: "1px solid rgba(231,231,235,.3)",
            background: "transparent",
            color: "#c3cedb",
            borderRadius: 12,
            padding: "12px 26px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
