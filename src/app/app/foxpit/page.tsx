import { Suspense } from "react";
import { FoxPitLobby } from "./Lobby";
import { FoxPitStyles } from "./styles";

/** Fox Pit practice-mode entry — the Lobby. */
export default function FoxPitPage() {
  return (
    <>
      <FoxPitStyles />
      {/* Suspense: the Lobby reads ?enter=1 via useSearchParams to skip the door splash on Quit. */}
      <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#0A0D12" }} />}>
        <FoxPitLobby />
      </Suspense>
    </>
  );
}
