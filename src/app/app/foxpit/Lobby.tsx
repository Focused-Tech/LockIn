"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArenaIntro } from "@/app/app/practice/arena/chooser/ArenaIntro";

/** Heavy tower assets (WebP) — preloaded during the lobby intro so the map paints instantly. */
const MAP_PRELOAD = [
  "/foxpit/map/tower_layers/tower_base.webp",
  "/foxpit/map/tower_layers/tower_stairs_overlay.webp",
];

/**
 * Fox Pit LOBBY — the practice-mode front door (background = lobby-scene.png).
 * Entry sequence: WELCOME gate (Boss Fox welcomes you in) -> lobby. Boss Fox
 * stands center, palms out; a small bouncing MINI-DOOR token floats over each
 * palm (LEFT = The Lone Fox, orange; RIGHT = The Boss Journey, brass) so the
 * painted fox art stays visible. Tapping a token opens the notice card in front
 * of that door; confirming does a corridor push-in and routes:
 *   Lone Fox  -> the existing practice arena ("Choose your arena")
 *   Boss Journey -> the tower map (avatars only).
 */
type Journey = "lone" | "boss";

const ROUTES: Record<Journey, string> = {
  lone: "/app/practice/arena/chooser",
  boss: "/app/foxpit/map",
};

export function FoxPitLobby() {
  const router = useRouter();
  const search = useSearchParams();
  // entry sequence: Boss Fox glass-door intro -> welcome/step-inside -> lobby. Fresh entry plays the
  // door intro; QUITTING A GAME arrives with ?enter=1 and lands STRAIGHT on the lobby landing (no
  // splash replay) — you left the game to get here, you don't sit through the door again.
  const [phase, setPhase] = useState<"door" | "welcome" | "lobby">(
    search.get("enter") === "1" ? "lobby" : "door",
  );
  const [popup, setPopup] = useState<Journey | null>(null);
  const [entering, setEntering] = useState<Journey | null>(null);

  // Warm the browser cache with the ~1MB of tower WebP while the player is still in the
  // door/welcome/choose-path intro, so /app/foxpit/map renders instantly on arrival instead
  // of fetching them cold. Fire-and-forget; no state, no render impact.
  useEffect(() => {
    MAP_PRELOAD.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const confirm = (j: Journey) => {
    setPopup(null);
    setEntering(j); // corridor push-in, then route
    window.setTimeout(() => router.push(ROUTES[j]), 620);
  };

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
      <style>{FOXPIT_LOBBY_CSS}</style>

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

      {/* back to journey hub (lobby only) */}
      {phase === "lobby" && (
        <button
          onClick={() => router.push("/app/choose")}
          style={backBtn}
          aria-label="Back"
        >
          ‹ Back
        </button>
      )}

      {/* title */}
      <div style={{ position: "absolute", top: 62, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 30, letterSpacing: ".14em", color: "#E7E7EB", textShadow: "0 2px 20px rgba(0,0,0,.8)" }}>
          THE FOX <span style={{ color: "#FC3E01" }}>PIT</span>
        </div>
        <div style={{ fontSize: 13, letterSpacing: ".22em", color: "#C8A24B", marginTop: 4, fontWeight: 700 }}>
          CHOOSE YOUR PATH
        </div>
      </div>

      {/* Phase 2 — small bouncing mini-door tokens in Boss Fox's palms */}
      <PalmToken side="left" accent="#FC3E01" title="THE LONE FOX" onClick={() => setPopup("lone")} />
      <PalmToken side="right" accent="#C8A24B" title="THE BOSS JOURNEY" onClick={() => setPopup("boss")} />

      {/* reused notice card in front of the chosen door */}
      {popup && (
        <JourneyPopup
          journey={popup}
          onClose={() => setPopup(null)}
          onChoose={() => confirm(popup)}
        />
      )}

      {/* corridor push-in transition */}
      {entering && (
        <div
          className="foxpit-pushin"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 80,
            pointerEvents: "none",
            background: entering === "lone" ? "#160a05" : "#14100a",
          }}
        />
      )}

      {/* Boss Fox glass-door intro — "Ready Boss Up?". Continue plaque fades in below his feet +
          the wordmark, jumping straight to the tower at the player's current floor. */}
      {phase === "door" && (
        <ArenaIntro
          revealTitle="Ready to Boss Up?"
          onDone={() => setPhase("welcome")}
          onContinue={() => router.push("/app/foxpit/map")}
        />
      )}

      {/* Continue where you left off — also on the lobby, below Boss Fox + the door tokens so it
          never overlaps them. Orange, plaque-translucent. Routes to the tower (resumes current floor). */}
      {phase === "lobby" && (
        <button onClick={() => router.push("/app/foxpit/map")} style={lobbyContinueBtn}>
          Continue where you left off ›
        </button>
      )}

      {/* WELCOME / step-inside gate (with a Back button) */}
      {phase === "welcome" && (
        <WelcomeGate
          onEnter={() => setPhase("lobby")}
          onBack={() => router.push("/app/choose")}
        />
      )}
    </div>
  );
}

/** A small door-shaped token that floats + gently bounces over a palm. */
function PalmToken({
  side,
  accent,
  title,
  onClick,
}: {
  side: "left" | "right";
  accent: string;
  title: string;
  onClick: () => void;
}) {
  // sit over each of Boss Fox's palms; a fixed-width button so the wide label
  // (absolutely centered below) never stretches or shifts the token.
  const pos: React.CSSProperties =
    side === "left"
      ? { left: "13%", transform: "translateX(-50%)" }
      : { right: "13%", transform: "translateX(50%)" };
  return (
    <button
      onClick={onClick}
      className="foxpit-token"
      aria-label={title}
      style={{
        position: "absolute",
        top: "47%",
        ...pos,
        width: 48,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {/* the mini door — bounces */}
      <div
        className="foxpit-token-door"
        style={{
          width: 48,
          height: 68,
          margin: "0 auto",
          borderRadius: "9px 9px 4px 4px",
          background: `linear-gradient(180deg, ${accent}, ${accent}88)`,
          border: `2px solid ${accent}`,
          boxShadow: `0 0 20px ${accent}, 0 8px 18px rgba(0,0,0,.6)`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 7,
            top: "50%",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(255,255,255,.9)",
            transform: "translateY(-50%)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          // bias each label toward screen center so the long ones don't clip the edge
          transform: side === "left" ? "translateX(-34%)" : "translateX(-66%)",
          marginTop: 40,
          fontSize: 9,
          letterSpacing: ".02em",
          color: "#fff",
          fontWeight: 800,
          textShadow: "0 2px 8px #000, 0 0 10px #000",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
    </button>
  );
}

/** Fox Pit WELCOME gate — the step-inside choice after the door animation. */
function WelcomeGate({ onEnter, onBack }: { onEnter: () => void; onBack: () => void }) {
  return (
    <div
      className="foxpit-welcome"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        background: "rgba(3,4,7,.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 30,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: ".3em", color: "#C8A24B", fontWeight: 800 }}>
        WELCOME TO
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 40, letterSpacing: ".1em", color: "#E7E7EB", marginTop: 6 }}>
        THE FOX <span style={{ color: "#FC3E01" }}>PIT</span>
      </div>
      <p
        style={{
          maxWidth: 340,
          marginTop: 22,
          fontSize: 18,
          lineHeight: 1.6,
          color: "#d8dee7",
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
        }}
      >
        Will you follow in the footsteps that made Boss Fox the boss he is
        today?
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 30, justifyContent: "center" }}>
        <button onClick={onBack} style={{ ...ghostBtn }}>
          Back
        </button>
        <button
          onClick={onEnter}
          style={{ ...primaryBtn("#FC3E01"), fontSize: 17, padding: "16px 30px" }}
        >
          Step inside ›
        </button>
      </div>
    </div>
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
            : "Follow Boss Fox's rise. Climb the tower floor by floor, beat each boss to earn their key, and become the next Boss."}
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "center" }}>
          <button onClick={onClose} style={{ ...ghostBtn }}>
            Back
          </button>
          <button onClick={onChoose} style={{ ...primaryBtn(accent) }}>
            {lone ? "Choose an arena ›" : "Become the next Boss ›"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FOXPIT_LOBBY_CSS = `
@keyframes foxpitTokenBounce { 0% { transform: translateY(-22px); animation-timing-function: cubic-bezier(.5,0,.9,.4); } 46% { transform: translateY(0); animation-timing-function: cubic-bezier(.12,.7,.35,1); } 100% { transform: translateY(-22px); } }
.foxpit-token-door { animation: foxpitTokenBounce 1.4s infinite; }
@keyframes foxpitPushIn { 0% { transform: scale(1); opacity: 0; } 45% { opacity: .9; } 100% { transform: scale(3.6); opacity: 1; } }
.foxpit-pushin { transform-origin: 50% 44%; animation: foxpitPushIn .62s ease-in forwards; }
@keyframes foxpitWelcomeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
.foxpit-welcome { animation: foxpitWelcomeIn .5s ease-out both; }
`;

const lobbyContinueBtn: React.CSSProperties = {
  position: "absolute",
  // Clear the Android bottom nav: the safe-area inset plus headroom so it never sits under the nav.
  bottom: "calc(env(safe-area-inset-bottom, 0px) + 9%)",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 65,
  background: "rgba(252,62,1,.2)",
  border: "1.5px solid rgba(252,62,1,.72)",
  color: "#ffefe8",
  borderRadius: 999,
  padding: "11px 22px",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: ".02em",
  whiteSpace: "nowrap",
  cursor: "pointer",
  backdropFilter: "blur(1px)",
  boxShadow: "0 0 18px rgba(252,62,1,.35)",
};
const backBtn: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 8,
  zIndex: 95,
  border: "1px solid rgba(200,162,75,.5)",
  background: "rgba(3,4,7,.62)",
  color: "#d8c79b",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 14,
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
