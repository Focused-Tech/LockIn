import type { PredictionInput } from "../types";

/** Fetch JSON with an abort timeout so settlement never hangs on a slow source. */
export async function fetchJsonWithTimeout(
  url: string,
  timeoutMs = 8000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map an over/under outcome to the option side. Over/under slates auto-label one
 * option "Over …" and the other "Under …"; this finds which is which so the
 * mapping is robust regardless of A/B ordering.
 */
export function overUnderChoice(
  input: PredictionInput,
  isOver: boolean,
): "a" | "b" | null {
  const a = input.optionA.toLowerCase();
  const b = input.optionB.toLowerCase();
  const aIsOver = a.includes("over");
  const bIsOver = b.includes("over");
  if (aIsOver === bIsOver) return null; // can't disambiguate
  const overSide: "a" | "b" = aIsOver ? "a" : "b";
  const underSide: "a" | "b" = overSide === "a" ? "b" : "a";
  return isOver ? overSide : underSide;
}

/** Case-insensitive "does the option label reference this team" check. */
export function labelMatchesTeam(label: string, ...teamNames: string[]): boolean {
  const l = label.toLowerCase();
  return teamNames.some((n) => n && l.includes(n.toLowerCase()));
}
