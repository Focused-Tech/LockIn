"use client";

import { ARENA_SESSIONS_NOT_IMPLEMENTED } from "@/lib/practice/arenaSession";

/**
 * COLISEUM — VISIBLE STUB (this pass). Team play, AI-rival selection, the
 * escalation ladder, and the growing pot/following are net-new backend
 * (arenaSessions collection + server actions) and are not wired yet. This screen
 * shows the shape of the mode and is explicitly labelled a preview — it does NOT
 * fake any live data. Role rule (locked): in Coliseum the creator is ALWAYS the
 * AI; the human crew is the team that challenges it.
 */
const ACCENT = "#e07a55";

export function ArenaColiseumStub() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <span
          className="text-xs font-extrabold uppercase tracking-[0.14em]"
          style={{ color: ACCENT }}
        >
          Coliseum
        </span>
        <h1 className="mt-1 text-xl font-semibold">Team vs the AI creator</h1>
        <p className="text-sm text-muted">
          Rally a crew by invite code and challenge the house AI together. Beat
          it and the rivalry climbs — tougher slates, a bigger following, a
          growing pot.
        </p>
      </div>

      <div
        className="rounded-xl border px-4 py-3 text-sm font-semibold"
        style={{
          borderColor: `${ACCENT}88`,
          background: `${ACCENT}1f`,
          color: "#ffd9c9",
        }}
      >
        ⚔ Preview — {ARENA_SESSIONS_NOT_IMPLEMENTED} Team rooms, AI rivals, and
        the escalation ladder are coming in the next pass.
      </div>

      {/* Non-interactive shape-of-the-mode preview (no live data). */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-4 opacity-70">
        <span className="text-sm font-semibold">How a Coliseum run will work</span>
        <ol className="flex flex-col gap-1.5 text-sm text-muted">
          <li>1 · Rally your team — generate invite codes, friends join.</li>
          <li>2 · Choose your AI rival (LockIn Fox or a roster AI).</li>
          <li>3 · Agree categories — the AI builds the slates.</li>
          <li>4 · Everyone plays their own card; best coins tops the board.</li>
          <li>5 · Run it back — the rival levels up and the pot grows.</li>
        </ol>
      </div>

      <p className="text-center text-xs text-muted">
        Want to play now? Try{" "}
        <span className="text-foreground">Parlay</span> or the{" "}
        <span className="text-foreground">Practice Dojo</span> from the chooser.
      </p>
    </div>
  );
}
