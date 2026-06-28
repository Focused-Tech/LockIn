"use client";

import { useEffect, useState } from "react";

/** Live countdown to a target time. Renders nothing until mounted (avoids SSR drift). */
export function Countdown({ targetMs }: { targetMs: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className="text-muted">—</span>;

  const ms = targetMs - now;
  if (ms <= 0) return <span className="text-live">Locking…</span>;

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const text =
    d > 0
      ? `${d}d ${h}h`
      : h > 0
        ? `${h}h ${m}m`
        : `${m}:${String(sec).padStart(2, "0")}`;

  // "Locking soon": pulse faster as lock approaches (under 60s → 1s pulse down
  // to ~0.3s at zero). Visual only here; audio is opt-in per screen.
  const LOCKING_SOON_MS = 60_000;
  const lockingSoon = ms < LOCKING_SOON_MS;
  if (lockingSoon) {
    const pulse = Math.max(0.3, ms / LOCKING_SOON_MS).toFixed(2);
    return (
      <span
        className="practice-lock-pulse inline-block tabular-nums text-live"
        style={{ "--pulse": `${pulse}s` } as React.CSSProperties}
      >
        {text}
      </span>
    );
  }

  return <span className="tabular-nums text-foreground">{text}</span>;
}
