"use client";

import { useEffect } from "react";

/**
 * Slate transition loader — reproduces design/design-reference/transition-lockin-mockup.html
 * 1:1: the shackle path, base rect and fox glyph + transform, the `openclose` /
 * `bump` @keyframes and 1.4s timing, and the +0.15s / +1.26s Web-Audio playback
 * of /sounds/lock-open.mp3 and /sounds/lock-close.mp3. One-shot on mount: the
 * shackle opens, slides down and seats, then stays closed while the slate loads;
 * the "Locking in…" text + dots carry the ongoing load. Does NOT loop.
 *
 * SEPARATE from <LockAnimation> (the close-only lock used on lock-in in
 * ArenaPlay / SpotRace) — intentionally not consolidated.
 */
export function SlateLockLoader({ creatorName }: { creatorName: string }) {
  useEffect(() => {
    let actx: AudioContext | null = null;
    let openBuf: AudioBuffer | null = null;
    let closeBuf: AudioBuffer | null = null;
    const timers: number[] = [];

    // Unlock the AudioContext on the first user gesture, as the mockup does.
    const resume = () => {
      if (actx && actx.state === "suspended") actx.resume().catch(() => {});
    };

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      actx = new Ctx();
      const load = async (url: string) => {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        return actx!.decodeAudioData(arr);
      };
      load("/sounds/lock-open.mp3")
        .then((b) => {
          openBuf = b;
        })
        .catch(() => {});
      load("/sounds/lock-close.mp3")
        .then((b) => {
          closeBuf = b;
        })
        .catch(() => {});
      resume();
      window.addEventListener("pointerdown", resume);
      window.addEventListener("click", resume);

      const play = (buf: AudioBuffer | null) => {
        if (!actx || !buf) return;
        const sx = actx.createBufferSource();
        sx.buffer = buf;
        sx.connect(actx.destination);
        sx.start();
      };
      // Matches the mockup: open at +0.15s, close as it seats at +1.26s.
      timers.push(window.setTimeout(() => play(openBuf), 150));
      timers.push(window.setTimeout(() => play(closeBuf), 1260));
    } catch {
      /* Web Audio unavailable — the animation still runs silently */
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("click", resume);
      try {
        actx?.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

  const first = creatorName.split(" ")[0];

  return (
    <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border bg-surface-card py-14 text-center">
      <div className="sll-glow" aria-hidden />
      <svg
        className="sll-lock"
        viewBox="0 0 150 180"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          className="sll-shackle"
          d="M48 150 L48 72 A27 27 0 0 1 102 72 L102 100"
          fill="none"
          stroke="#FF3B00"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <rect
          className="sll-base"
          x={30}
          y={96}
          width={90}
          height={76}
          rx={17}
          fill="#FF3B00"
        />
        {/* Fox glyph — verbatim from the mockup (leading M added so the path is
            valid; coordinates + transform are otherwise unchanged). */}
        <g transform="translate(75,137) scale(0.2153) translate(-255.5,-328.5)">
          <path
            d="M210,265 210,291 215,312 206,324 208,326 198,339 208,345 211,351 223,357 232,367 236,377 249,389 256,392 275,376 277,369 286,358 301,350 300,347 313,339 305,330 303,322 295,312 300,293 301,266 299,265 289,272 272,288 256,284 239,288 224,274Z"
            fill="#0A0D12"
            fillRule="evenodd"
          />
        </g>
      </svg>
      <p className="mt-2 text-sm text-muted">
        Locking in {first}&apos;s slate
        <span className="sll-dots">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </p>

      <style jsx>{`
        .sll-glow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle,
            rgba(255, 59, 0, 0.14),
            rgba(255, 59, 0, 0.04) 45%,
            transparent 70%
          );
          pointer-events: none;
        }
        .sll-lock {
          position: relative;
          width: 132px;
          height: 158px;
          filter: drop-shadow(0 6px 16px rgba(255, 59, 0, 0.22));
        }
        .sll-shackle {
          transform-box: fill-box;
          animation: sll-openclose 1.4s cubic-bezier(0.45, 0, 0.25, 1) forwards;
        }
        .sll-base {
          transform-box: fill-box;
          transform-origin: center;
          animation: sll-bump 1.4s ease forwards;
        }
        @keyframes sll-openclose {
          0%,
          10% {
            transform: translateY(0);
          }
          32%,
          58% {
            transform: translateY(-34px);
          }
          90% {
            transform: translateY(0);
          }
          95% {
            transform: translateY(3px);
          }
          100% {
            transform: translateY(0);
          }
        }
        @keyframes sll-bump {
          0%,
          86% {
            transform: scale(1);
          }
          92% {
            transform: scale(1.045);
          }
          100% {
            transform: scale(1);
          }
        }
        .sll-dots i {
          opacity: 0.25;
          font-style: normal;
          animation: sll-blink 1.4s infinite;
        }
        .sll-dots i:nth-child(2) {
          animation-delay: 0.2s;
        }
        .sll-dots i:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes sll-blink {
          0%,
          100% {
            opacity: 0.25;
          }
          40% {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sll-shackle,
          .sll-base {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
