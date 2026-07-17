"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FOXPIT_ROOMS,
  LOBBY_MAP_Y,
  getCleared,
  isUnlocked,
  keyLabel,
  type FoxPitRoomKey,
} from "@/lib/foxpit";

/**
 * Fox Pit TOWER MAP (background = map-tower.png) — a tall vertical climb.
 * Each floor is a tappable hotspot: unlocked = highlighted, locked = dimmed +
 * padlock + which boss-key it needs. Elevator far-left (locked in practice,
 * unlocks at the High Table) + switchback stairs for the practice floors.
 */
export function FoxPitMap({ lone = false }: { lone?: boolean }) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cleared, setCleared] = useState<Set<FoxPitRoomKey>>(new Set());

  useEffect(() => {
    setCleared(getCleared());
    // start at the bottom (the Dojo) — you climb up
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const enter = (key: FoxPitRoomKey) => router.push(`/app/foxpit/room/${key}`);

  return (
    <div
      ref={scrollRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#0A0D12",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/map-tower.png"
          alt="The Fox Pit tower"
          style={{ width: "100%", display: "block" }}
        />

        {/* floor hotspots */}
        {FOXPIT_ROOMS.map((r) => {
          const unlocked = lone || isUnlocked(r, cleared);
          const current = unlocked && !cleared.has(r.key);
          return (
            <button
              key={r.key}
              onClick={() => unlocked && enter(r.key)}
              disabled={!unlocked}
              style={{
                position: "absolute",
                top: `${r.mapY * 100}%`,
                left: "30%",
                width: "56%",
                transform: "translateY(-50%)",
                padding: "10px 12px",
                borderRadius: 12,
                textAlign: "center",
                cursor: unlocked ? "pointer" : "not-allowed",
                color: "#E7E7EB",
                background: unlocked ? "rgba(10,13,18,.55)" : "rgba(3,4,7,.72)",
                border: `2px solid ${current ? "#FC3E01" : unlocked ? r.accent : "#3a4653"}`,
                boxShadow: current
                  ? "0 0 30px rgba(252,62,1,.5)"
                  : unlocked
                    ? `0 0 20px ${r.accent}44`
                    : "none",
                filter: unlocked ? "none" : "grayscale(.5) brightness(.7)",
                animation: current ? "foxpitGlow 2.6s ease-in-out infinite" : "none",
              }}
            >
              <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, letterSpacing: ".05em" }}>
                {r.name}
              </div>
              <div style={{ fontSize: 11, letterSpacing: ".14em", color: "#aeb9c6", marginTop: 2 }}>
                {r.floorLabel}
              </div>
              {current && (
                <div style={{ fontSize: 11, color: "#ffb089", fontWeight: 800, marginTop: 4, letterSpacing: ".1em" }}>
                  ▸ ENTER
                </div>
              )}
              {!unlocked && (
                <div style={{ fontSize: 12, color: "#c8a24b", fontWeight: 800, marginTop: 4, letterSpacing: ".06em" }}>
                  🔒 NEEDS {keyLabel(r.needsKey!)} KEY
                </div>
              )}
            </button>
          );
        })}

        {/* lobby landmark (street level, a hub — tap to return to the lobby) */}
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{
            position: "absolute",
            top: `${LOBBY_MAP_Y * 100}%`,
            left: "30%",
            width: "56%",
            transform: "translateY(-50%)",
            padding: "8px 12px",
            borderRadius: 12,
            textAlign: "center",
            cursor: "pointer",
            color: "#d8c79b",
            background: "rgba(10,13,18,.5)",
            border: "2px solid rgba(200,162,75,.45)",
          }}
        >
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 700, letterSpacing: ".06em" }}>
            The Lobby
          </div>
          <div style={{ fontSize: 10, letterSpacing: ".16em", color: "#8b98a6", marginTop: 2 }}>
            STREET · HUB
          </div>
        </button>

        {/* elevator tag (far left, locked in practice) */}
        <div
          style={{
            position: "absolute",
            top: "34%",
            left: "1.5%",
            width: "16%",
            transform: "translateY(-50%)",
            padding: "8px 4px",
            borderRadius: 8,
            textAlign: "center",
            background: "rgba(3,4,7,.72)",
            border: "1px solid rgba(200,162,75,.35)",
            color: "#9a844f",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: ".08em",
            lineHeight: 1.5,
          }}
        >
          ELEVATOR<br />🔒 LOCKED<br />opens at the<br />High Table
        </div>
      </div>

      {/* fixed HUD over the scroll */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 110, zIndex: 61, pointerEvents: "none", background: "linear-gradient(180deg,rgba(3,4,7,.92),transparent)" }}>
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{ position: "absolute", top: 18, left: 18, pointerEvents: "auto", border: "1px solid rgba(200,162,75,.5)", background: "rgba(3,4,7,.6)", color: "#d8c79b", borderRadius: 12, padding: "12px 18px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
        >
          ‹ Lobby
        </button>
        <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".12em", color: "#E7E7EB" }}>
            {lone ? "CHOOSE AN ARENA" : "THE BOSS JOURNEY"}
          </div>
          <div style={{ fontSize: 12, letterSpacing: ".2em", color: "#C8A24B", fontWeight: 700, marginTop: 2 }}>
            CLIMB THE TOWER
          </div>
        </div>
      </div>
    </div>
  );
}
