"use client";

import { useRouter } from "next/navigation";
import { FOXPIT_ROOMS } from "@/lib/foxpit";

/**
 * Fox Pit LONE FOX arena selection — self-paced. Every arena is open; pick one
 * and drop in. (The locked-progression climb is the Boss Journey / tower map.)
 */
export function FoxPitRoomsGrid() {
  const router = useRouter();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#0A0D12", overflowY: "auto" }}>
      <div style={{ padding: "120px 20px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {FOXPIT_ROOMS.map((r) => (
            <button
              key={r.key}
              onClick={() => router.push(`/app/foxpit/room/${r.key}`)}
              style={{
                position: "relative",
                borderRadius: 14,
                overflow: "hidden",
                border: `2px solid ${r.accent}`,
                boxShadow: `0 0 20px ${r.accent}33, 0 10px 24px rgba(0,0,0,.5)`,
                cursor: "pointer",
                aspectRatio: "3 / 4",
                background: "#0a0d13",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={r.roomImg}
                alt={r.name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 50%,rgba(3,4,7,.9))" }} />
              <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, textAlign: "left" }}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: "#E7E7EB", fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, letterSpacing: ".1em", color: r.accent, fontWeight: 800, marginTop: 2 }}>
                  HOST · {r.boss.toUpperCase()}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 110, zIndex: 61, background: "linear-gradient(180deg,rgba(3,4,7,.92),transparent)" }}>
        <button
          onClick={() => router.push("/app/foxpit")}
          style={{ position: "absolute", top: 18, left: 18, border: "1px solid rgba(200,162,75,.5)", background: "rgba(3,4,7,.6)", color: "#d8c79b", borderRadius: 12, padding: "12px 18px", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
        >
          ‹ Lobby
        </button>
        <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".12em", color: "#E7E7EB" }}>THE LONE FOX</div>
          <div style={{ fontSize: 12, letterSpacing: ".2em", color: "#FC3E01", fontWeight: 700, marginTop: 2 }}>CHOOSE YOUR ARENA</div>
        </div>
      </div>
    </div>
  );
}
