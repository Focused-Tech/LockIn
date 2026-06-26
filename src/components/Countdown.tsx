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

  return <span className="tabular-nums text-foreground">{text}</span>;
}
