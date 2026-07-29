"use client";

import { FOXPIT_BUILD_VERSION } from "@/lib/foxpit/rules";

/**
 * 3.3b — ROUND CHROME (screen chrome, never card furniture).
 *
 * The keydrop lives HERE, beside the round timer — never pinned to or floating over a card, which is
 * what overlapped the "THE CARDS COME OVER" headline. The title splits across two lines so a long
 * opponent name (e.g. "SENSEI OWL · ROUND 1/2") no longer truncates.
 */
export function RoundChrome({
  oppName, roundIndex, rounds, keepN, slatesPerRound, accent,
  clockVisible, clockLabel, clockAlert, roundsWon, onQuit, onKeydrop,
}: {
  oppName: string;
  roundIndex: number;
  rounds: number;
  keepN: number;
  slatesPerRound: number;
  accent: string;
  clockVisible: boolean;
  clockLabel: string;
  clockAlert: boolean;
  roundsWon: number;
  onQuit: () => void;
  /** dev keydrop preview — omit to remove the control. It lives in the chrome, never on a card. */
  onKeydrop?: () => void;
}) {
  return (
    <div
      data-round-chrome
      className="sticky top-0 z-40 flex items-center gap-2 border-b border-border px-3 pb-2"
      style={{ background: "#0A0D12", paddingTop: "calc(env(safe-area-inset-top,0px) + 8px)" }}
    >
      <button onClick={onQuit} data-quit className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted">
        ‹ Quit
      </button>
      <div className="min-w-0 flex-1 text-center">
        {/* line 1 = opponent only; line 2 = round + keep — short lines, no truncation. */}
        <div data-chrome-title className="truncate text-base font-extrabold tracking-wide" style={{ color: accent }}>
          {oppName.toUpperCase()}
        </div>
        <div className="truncate text-[11px] font-semibold text-muted">
          ROUND {roundIndex + 1}/{rounds} · KEEP {keepN}/{slatesPerRound}
        </div>
      </div>
      {/* CLOCK + KEYDROP — chrome, beside the timer. */}
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          {onKeydrop && (
            <button
              onClick={onKeydrop}
              data-keydrop
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold"
              style={{ borderColor: "#FF3B00", background: "rgba(6,8,12,.9)", color: "#FF3B00" }}
            >
              🔑
            </button>
          )}
          {clockVisible && (
            <div
              data-clock
              className="rounded-full border px-2.5 py-0.5 text-sm font-extrabold tabular-nums"
              style={{ borderColor: clockAlert ? "#E85454" : accent, color: clockAlert ? "#E85454" : accent, background: "rgba(6,8,12,.95)" }}
            >
              {clockLabel}
            </div>
          )}
        </div>
        <div className="text-[8px] leading-none text-muted">w{roundsWon} · {FOXPIT_BUILD_VERSION}</div>
      </div>
    </div>
  );
}
