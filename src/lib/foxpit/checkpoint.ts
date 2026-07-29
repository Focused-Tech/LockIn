/**
 * §3.1 — FOX PIT RESUME CHECKPOINT.
 *
 * The last room/table/round the player was in, persisted client-side so "Continue where you left
 * off" lands them back on the EXACT seat + round. Written by the room as the player advances; read
 * by the lobby's Continue controls. localStorage-only (client); every accessor is failure-safe.
 */
import type { FoxPitRoomKey } from "@/lib/foxpit";

export interface FoxPitCheckpoint {
  room: FoxPitRoomKey;
  /** 0-based table index (the seated underling / normal table). */
  table: number;
  /** 0-based round index within that table's match. */
  round: number;
}

const KEY = "foxpit.checkpoint.v1";

export function writeFoxCheckpoint(cp: FoxPitCheckpoint): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cp));
  } catch (err) {
    console.error("[foxpit] checkpoint write failed", err);
  }
}

export function readFoxCheckpoint(): FoxPitCheckpoint | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const cp = JSON.parse(raw) as FoxPitCheckpoint;
    if (
      !cp ||
      typeof cp.room !== "string" ||
      typeof cp.table !== "number" ||
      typeof cp.round !== "number"
    ) {
      return null;
    }
    return cp;
  } catch (err) {
    console.error("[foxpit] checkpoint read failed", err);
    return null;
  }
}

export function clearFoxCheckpoint(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    console.error("[foxpit] checkpoint clear failed", err);
  }
}

/** Deep-link for "Continue where you left off" → the exact room/table/round, or null if none saved. */
export function foxResumeHref(): string | null {
  const cp = readFoxCheckpoint();
  if (!cp) return null;
  return `/app/foxpit/room/${cp.room}?table=${cp.table}&round=${cp.round}`;
}
