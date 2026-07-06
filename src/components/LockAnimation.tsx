"use client";

import { useEffect, useRef } from "react";

/**
 * LockIn lock animation (ported 1:1 from design-reference2 lock-animation-mockup):
 * the shackle slides straight DOWN into the base (no swivel), left arm long /
 * right arm short (just meets the base), solid-orange base with a BLACK keyhole.
 * A Web Audio "click" fires as it seats (~740ms). Timings/paths match the mockup
 * exactly. Mount it to play once.
 */

const ORANGE = "#FF3B00";
const KEY = "#0A0D12"; // --bg, the black keyhole fill

function playLockClick() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const t = ctx.currentTime;
    // high-passed noise burst (the metallic snap)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(hp);
    hp.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    // short triangle thunk (the body of the click)
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 170;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g2);
    g2.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch {
    /* Web Audio unavailable — silent, never blocks the animation */
  }
}

export function LockAnimation({
  size = 120,
  sound = true,
  onDone,
}: {
  size?: number;
  sound?: boolean;
  onDone?: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const clickAt = sound ? window.setTimeout(playLockClick, 740) : undefined;
    const doneAt = window.setTimeout(() => onDoneRef.current?.(), 950);
    return () => {
      if (clickAt) clearTimeout(clickAt);
      clearTimeout(doneAt);
    };
  }, [sound]);

  return (
    <svg
      className="lockin-lock"
      viewBox="0 0 150 180"
      width={size}
      height={(size * 180) / 150}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        className="lockin-shackle"
        d="M48 150 L48 66 A27 27 0 0 1 102 66 L102 100"
        fill="none"
        stroke={ORANGE}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <rect
        className="lockin-base"
        x={30}
        y={96}
        width={90}
        height={76}
        rx={17}
        fill={ORANGE}
      />
      {/* black keyhole: circle + trapezoid */}
      <circle cx={75} cy={128} r={8.5} fill={KEY} />
      <path d="M71 133 L79 133 L82 152 L68 152 Z" fill={KEY} />
    </svg>
  );
}
