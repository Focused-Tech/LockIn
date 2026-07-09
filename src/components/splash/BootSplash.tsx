"use client";

import { useEffect, useRef, useState } from "react";
import { isNativePlatform } from "@/lib/platform";

/**
 * OTA boot splash — reproduces the approved `lockin_splash_iphone.html` 1:1:
 * the fox scene background (`/splash-bg-portrait.png`, 502×1080) with the LockIn
 * padlock resting on the fox's open palm, a one-shot shackle open/close, the two
 * lock sounds (open +0.15s, close +1.26s), and the "Focused Technologies Inc."
 * footer under the feet. Shows for 3000ms, then removes itself and calls the
 * native SplashScreen.hide().
 *
 * The lock is the same design as <SlateLockLoader> (identical shackle path + fox
 * glyph + openclose/bump keyframes), sized per the approved splash (wider base,
 * larger fox). Reused here as an overlay, NOT edited.
 *
 * Positioning: the background box is reproduced as a 502/1080 "stage" scaled to
 * COVER the viewport and centered, so the lock's percentage offsets
 * (left 52.79% / top 33.79% / width 25.90%) land on the palm on any screen
 * aspect (including the Fold's narrower cover display), exactly as approved.
 */

const SPLASH_MS = 3000;
const BG_W = 502;
const BG_H = 1080;

export function BootSplash() {
  const [gone, setGone] = useState(false);
  const lockRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let actx: AudioContext | null = null;
    let openBuf: AudioBuffer | null = null;
    let closeBuf: AudioBuffer | null = null;
    const timers: number[] = [];

    // --- Web Audio: decode the two existing clips up front, unlock on gesture ---
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      actx = new Ctx();
      const load = async (url: string) => {
        const res = await fetch(url);
        return actx!.decodeAudioData(await res.arrayBuffer());
      };
      load("/sounds/lock-open.mp3")
        .then((b) => (openBuf = b))
        .catch(() => {});
      load("/sounds/lock-close.mp3")
        .then((b) => (closeBuf = b))
        .catch(() => {});
    } catch {
      /* Web Audio unavailable — the animation still runs silently */
    }

    const sched = (buf: AudioBuffer | null, when: number) => {
      if (!actx || !buf) return;
      const s = actx.createBufferSource();
      s.buffer = buf;
      s.connect(actx.destination);
      s.start(when);
    };

    // Fire the shackle open/close once, scheduled off the audio clock. This is
    // the ONLY thing that plays the lock sound here — no per-interaction replay.
    const playSounds = () => {
      const t = actx ? actx.currentTime : 0;
      sched(openBuf, t + 0.15);
      sched(closeBuf, t + 1.26);
    };

    // The lock animation runs on mount (the SVG carries `animate` in its markup).
    // Try the sounds immediately; if audio is still gesture-locked they're
    // inaudible and the single unlock below replays them once.
    timers.push(window.setTimeout(playSounds, 250));

    // ONE-SHOT gesture unlock. CRITICAL: this must detach after firing (and be
    // force-removed when the splash ends) — a lingering global listener is what
    // made the lock sound play on every scroll/tap across the whole app. It
    // resumes the audio context and replays the one-shot a single time, nothing
    // more (no animation restart, no re-arm).
    function removeUnlock() {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("click", unlock);
    }
    function unlock() {
      removeUnlock();
      if (actx && actx.state === "suspended") {
        actx.resume().then(playSounds).catch(() => {});
      }
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("click", unlock);

    // Hand off from the native splash to this web splash.
    if (isNativePlatform()) {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => {});
    }

    // End the splash. The component returns null but never unmounts, so the
    // return cleanup can't be relied on — detach the unlock listeners here too.
    timers.push(
      window.setTimeout(() => {
        setGone(true);
        removeUnlock();
      }, SPLASH_MS),
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
      removeUnlock();
      try {
        actx?.close();
      } catch {
        /* already closed */
      }
    };
  }, []);

  if (gone) return null;

  return (
    <div className="boot-splash" aria-hidden>
      <div className="boot-stage">
        <img
          className="boot-bg"
          src="/splash-bg-portrait.png"
          alt=""
          draggable={false}
        />
        <div className="boot-lockpos">
          <svg
            ref={lockRef}
            className="boot-lock animate"
            viewBox="0 0 150 180"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="boot-shackle"
              d="M48 150 L48 72 A27 27 0 0 1 102 72 L102 100"
              fill="none"
              stroke="#FC3D02"
              strokeWidth={14}
              strokeLinecap="round"
            />
            <rect
              className="boot-base"
              x={21.5}
              y={96}
              width={107}
              height={76}
              rx={17}
              fill="#FC3D02"
            />
            <g transform="translate(75,133.3) scale(0.28958) translate(-255.5,-328.5)">
              <path
                d="M210,265 210,291 215,312 206,324 208,326 198,339 208,345 211,351 223,357 232,367 236,377 249,389 256,392 275,376 277,369 286,358 301,350 300,347 313,339 305,330 303,322 295,312 300,293 301,266 299,265 289,272 272,288 256,284 239,288 224,274Z"
                fill="#0A0D12"
                fillRule="evenodd"
              />
            </g>
          </svg>
        </div>
        <div className="boot-footer">FOCUSED TECHNOLOGIES INC.</div>
      </div>

      <style jsx>{`
        .boot-splash {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0a0d12;
          overflow: hidden;
        }
        /* 502/1080 box scaled to COVER the viewport, centered — reproduces the
           mockup's coordinate space so the lock % offsets hit the palm. */
        .boot-stage {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: max(100vw, calc(100dvh * ${BG_W} / ${BG_H}));
          height: max(100dvh, calc(100vw * ${BG_H} / ${BG_W}));
        }
        .boot-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .boot-lockpos {
          position: absolute;
          left: 52.79%;
          top: 33.79%;
          width: 25.9%;
        }
        .boot-lock {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(0 6px 16px rgba(255, 59, 0, 0.22));
        }
        .boot-shackle {
          transform-box: fill-box;
        }
        .boot-lock.animate .boot-shackle {
          animation: boot-openclose 1.4s cubic-bezier(0.45, 0, 0.25, 1) forwards;
        }
        .boot-lock.animate .boot-base {
          animation: boot-bump 1.4s ease forwards;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes boot-openclose {
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
        @keyframes boot-bump {
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
        .boot-footer {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 3.4%;
          text-align: center;
          color: #d6d6d6;
          letter-spacing: 0.16em;
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Helvetica, Arial, sans-serif;
        }
        @media (prefers-reduced-motion: reduce) {
          .boot-lock.animate .boot-shackle,
          .boot-lock.animate .boot-base {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
