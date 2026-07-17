"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Fox Pit LOBBY — the practice-mode front door (background = lobby-scene.png).
 * Boss Fox stands center, palms out. Over each palm / door arch a floating
 * SLATE-CARD banner: LEFT = "The Lone Fox" (self-paced), RIGHT = "The Boss
 * Journey" (climb the tower). Tapping a banner opens a pop-up; choosing routes:
 * Lone Fox -> room selection, Boss Journey -> the tower map.
 */
type Journey = "lone" | "boss" | null;

export function FoxPitLobby() {
  const router = useRouter();
  const [popup, setPopup] = useState<Journey>(null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "#0A0D12",
        overflow: "hidden",
      }}
    >
      {/* painted lobby scene, full-bleed */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/foxpit/lobby-scene.png"
        alt="The Fox Pit lobby"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 42%",
        }}
      />
      {/* subtle top/bottom scrims for legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(10,13,18,.55), transparent 22%, transparent 70%, rgba(10,13,18,.85))",
        }}
      />

      {/* back to journey hub */}
      <button
        onClick={() => router.push("/app/choose")}
        style={backBtn}
        aria-label="Back"
      >
        ‹ Back
      </button>

      {/* title */}
      <div style={{ position: "absolute", top: 62, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, letterSpacing: ".14em", color: "#E7E7EB", textShadow: "0 2px 20px rgba(0,0,0,.8)" }}>
          THE FOX <span style={{ color: "#FC3E01" }}>PIT</span>
        </div>
        <div style={{ fontSize: 13, letterSpacing: ".22em", color: "#C8A24B", marginTop: 4, fontWeight: 700 }}>
          CHOOSE YOUR PATH
        </div>
      </div>

      {/* LEFT banner — The Lone Fox (over the left palm / fox-emblem door) */}
      <SlateBanner
        style={{ left: "5%", top: "39%", width: "34%" }}
        outline="#FC3E01"
        kicker="Left door"
        title="THE LONE FOX"
        onClick={() => setPopup("lone")}
      />

      {/* RIGHT banner — The Boss Journey (over the right palm / crown door) */}
      <SlateBanner
        style={{ right: "5%", top: "39%", width: "34%" }}
        outline="#C8A24B"
        kicker="Right door"
        title="THE BOSS JOURNEY"
        onClick={() => setPopup("boss")}
      />

      {/* pop-up */}
      {popup && (
        <JourneyPopup
          journey={popup}
          onClose={() => setPopup(null)}
          onChoose={() =>
            router.push(popup === "lone" ? "/app/foxpit/rooms" : "/app/foxpit/map")
          }
        />
      )}
    </div>
  );
}

function SlateBanner({
  style,
  outline,
  kicker,
  title,
  onClick,
}: {
  style: React.CSSProperties;
  outline: string;
  kicker: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        ...style,
        padding: "12px 10px",
        borderRadius: 12,
        background: "rgba(10,13,18,.82)",
        border: `2px solid ${outline}`,
        boxShadow: `0 0 26px ${outline}55, 0 10px 24px rgba(0,0,0,.6)`,
        color: "#E7E7EB",
        textAlign: "center",
        cursor: "pointer",
        backdropFilter: "blur(2px)",
        animation: "foxpitBob 3.2s ease-in-out infinite",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: ".18em", color: outline, fontWeight: 800, textTransform: "uppercase" }}>
        {kicker}
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 700, letterSpacing: ".04em", marginTop: 3 }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: "#8b98a6", marginTop: 4, letterSpacing: ".1em" }}>TAP</div>
    </button>
  );
}

function JourneyPopup({
  journey,
  onClose,
  onChoose,
}: {
  journey: "lone" | "boss";
  onClose: () => void;
  onChoose: () => void;
}) {
  const lone = journey === "lone";
  const accent = lone ? "#FC3E01" : "#C8A24B";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(3,4,7,.72)",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 18,
          background: "linear-gradient(180deg,#141821,#0a0d13)",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 40px ${accent}44, 0 24px 60px rgba(0,0,0,.7)`,
          padding: 26,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "#E7E7EB", letterSpacing: ".04em" }}>
          {lone ? "The Lone Fox" : "The Boss Journey"}
        </div>
        <div style={{ width: 90, height: 2, margin: "14px auto", background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />
        <p style={{ fontSize: 16, lineHeight: 1.55, color: "#c3cedb" }}>
          {lone
            ? "Play at your own pace. Pick any arena, sharpen your skills, and climb the leaderboard on your own terms."
            : "Follow Boss Fox's rise. Climb the tower floor by floor, beat each boss to earn their key, and win the tournament at the top."}
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "center" }}>
          <button onClick={onClose} style={{ ...ghostBtn }}>
            Back
          </button>
          <button onClick={onChoose} style={{ ...primaryBtn(accent) }}>
            {lone ? "Choose an arena ›" : "Enter the tower ›"}
          </button>
        </div>
      </div>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  position: "absolute",
  top: 18,
  left: 18,
  zIndex: 65,
  border: "1px solid rgba(200,162,75,.5)",
  background: "rgba(3,4,7,.6)",
  color: "#d8c79b",
  borderRadius: 12,
  padding: "12px 18px",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  border: "1px solid rgba(231,231,235,.3)",
  background: "transparent",
  color: "#c3cedb",
  borderRadius: 12,
  padding: "14px 22px",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const primaryBtn = (accent: string): React.CSSProperties => ({
  border: `1px solid ${accent}`,
  background: `${accent}22`,
  color: "#ffe",
  borderRadius: 12,
  padding: "14px 22px",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
});
