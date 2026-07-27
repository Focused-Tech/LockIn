"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

/**
 * BOSS FOX glass-door intro (ported natively from
 * design-reference/arena-workflow-prototype-CRESTOVERLAY.html — assets + timings
 * matched exactly). Plays once before the chooser carousel:
 *   0.0s  tinted-glass nightclub door, 158px crest badge + 0.55 glass-tint overlay
 *   2.2s  door swings open (3D rotateY(-118deg)), revealing the Boss Fox in the
 *         neon room (feathered edges, ears fully visible — baked into the asset)
 *   3.8s  Fox scales down / backs up; UPRIGHT wordmark appears beneath his feet;
 *         "Choose your arena" swipes in right-to-left
 *   7.1s  done → carousel
 * Tap anywhere to skip.
 */
export function ArenaIntro({
  onDone,
  revealTitle = "Choose your arena",
  brandPrefix = "to the",
  brandName = "Fox Pit",
  revealImage = "/arena/intro/fox.png",
  showWordmark = true,
  onContinue,
  continueLabel = "Continue where you left off",
}: {
  onDone: () => void;
  revealTitle?: string;
  /** Small line above the brand name on the glass door (default "to the"). */
  brandPrefix?: string;
  /** The big brand name on the glass door — "Fox Pit" (lobby) or "Winner's Lounge" (lounge). */
  brandName?: string;
  /** What the door swings open to reveal (default the Boss-Fox neon-room cutout). */
  revealImage?: string;
  /** Show the upright wordmark reflection beneath the reveal (lobby only). */
  showWordmark?: boolean;
  /** When set, a "Continue where you left off" plaque fades in BELOW the wordmark (moving in with
   *  Boss Fox's zoom-out) — resumes the journey without waiting out the intro. Lobby only. */
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [backed, setBacked] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const t = timers.current;
    t.push(window.setTimeout(() => setOpen(true), 2200));
    t.push(window.setTimeout(() => setBacked(true), 3800));
    t.push(window.setTimeout(() => doneRef.current(), 7100));
    return () => t.forEach(clearTimeout);
  }, []);

  function skip() {
    timers.current.forEach(clearTimeout);
    doneRef.current();
  }

  return (
    <div
      className={"door-scene" + (open ? " open" : "") + (backed ? " backed" : "")}
      onClick={skip}
    >
      <div className="door-reveal">
        <div className="reveal-fox" style={{ backgroundImage: `url("${revealImage}")` }} />
        {showWordmark && (
          <div className="reveal-reflect">
            <img className="reveal-wordmark" src="/arena/intro/wordmark.png" alt="" />
          </div>
        )}
        {revealTitle && <div className="reveal-arena-title">{revealTitle}</div>}
        {onContinue && (
          <button
            className="reveal-continue"
            onClick={(e) => { e.stopPropagation(); onContinue(); }}
          >
            {continueLabel}
          </button>
        )}
      </div>
      <div className="door-seam" />
      <div className="glass-door">
        <div className="door-welcome">Welcome</div>
        <img className="door-crest-img" src="/foxpit/emblem-fox-neon.png" alt="" />
        <div className="door-crest-tint" />
        <div className="door-below">
          <div className="door-tothe">{brandPrefix}</div>
          <div className="door-foxpit">{brandName}</div>
        </div>
      </div>
      <div className="intro-skip">Tap to skip</div>

      <style jsx>{`
        .door-scene {
          position: fixed;
          inset: 0;
          z-index: 50;
          overflow: hidden;
          background: #05060a;
          perspective: 1600px;
        }
        .door-reveal {
          position: absolute;
          inset: 0;
          overflow: hidden;
          /* Query container so the arena title scales with the STAGE width (the
             phone column), not the raw viewport — see .reveal-arena-title. */
          container-type: inline-size;
          background: radial-gradient(
            ellipse at 50% 42%,
            #2a1746 0%,
            #140b26 46%,
            #08060f 100%
          );
        }
        .reveal-fox {
          position: absolute;
          inset: 0;
          /* image is set inline (revealImage prop); position/size stay fixed here */
          background-position: center 30%;
          background-size: contain;
          background-repeat: no-repeat;
          transform: scale(1.26);
          transform-origin: center 52%;
          transition: transform 1.5s cubic-bezier(0.3, 0.7, 0.25, 1);
        }
        .door-scene.backed .reveal-fox {
          transform: scale(0.84) translateY(-3%);
        }
        .reveal-reflect {
          position: absolute;
          left: 50%;
          /* wordmark sits under Boss Fox's feet; raised so the Continue plaque clears it below */
          top: 74%;
          width: 118px;
          transform: translateX(-50%) translateY(10px);
          opacity: 0;
          z-index: 5;
          transition:
            opacity 0.6s ease 0.5s,
            transform 0.6s ease 0.5s;
        }
        .door-scene.backed .reveal-reflect {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .reveal-wordmark {
          width: 100%;
          display: block;
          filter: drop-shadow(0 0 10px rgba(255, 59, 0, 0.35));
        }
        .reveal-arena-title {
          position: absolute;
          top: 26%;
          right: 5%;
          width: max-content;
          max-width: none;
          /* One line, always — scale to fit the stage instead of wrapping. */
          white-space: nowrap;
          text-align: right;
          z-index: 4;
          color: #fff;
          font-size: clamp(14px, 6cqw, 24px);
          font-weight: 900;
          line-height: 1.12;
          letter-spacing: 0.3px;
          text-shadow:
            0 0 16px rgba(0, 0, 0, 0.85),
            0 0 22px rgba(255, 90, 20, 0.35);
          opacity: 0;
          transform: translateX(72px);
          transition:
            opacity 0.55s ease 0.75s,
            transform 0.6s cubic-bezier(0.2, 0.8, 0.3, 1) 0.75s;
        }
        .door-scene.backed .reveal-arena-title {
          opacity: 1;
          transform: translateX(0);
        }
        /* CONTINUE plaque — below Boss Fox's feet + below the wordmark. Orange, plaque-translucent
           (matches the tower plaques). Fades + slides in with his zoom-out (the .backed beat). */
        .reveal-continue {
          position: absolute;
          left: 50%;
          /* bottom-anchored + safe-area so the plaque always clears the Android nav, and sits
             well below the wordmark (top:74%) — no overlap either side. */
          bottom: calc(env(safe-area-inset-bottom, 0px) + 26px);
          transform: translateX(-50%) translateY(12px);
          z-index: 6;
          opacity: 0;
          transition:
            opacity 0.6s ease 0.65s,
            transform 0.6s ease 0.65s;
          background: rgba(252, 62, 1, 0.2);
          border: 1.5px solid rgba(252, 62, 1, 0.72);
          color: #ffefe8;
          border-radius: 999px;
          padding: 9px 20px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.02em;
          white-space: nowrap;
          cursor: pointer;
          backdrop-filter: blur(1px);
          box-shadow: 0 0 18px rgba(252, 62, 1, 0.35);
        }
        .door-scene.backed .reveal-continue {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .door-reveal::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(
            circle at 50% 52%,
            rgba(255, 90, 20, 0.1),
            transparent 60%
          );
        }
        .door-seam {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 12px;
          z-index: 7;
          background: linear-gradient(
            90deg,
            rgba(170, 200, 255, 0.9),
            rgba(255, 120, 40, 0.4),
            transparent
          );
          filter: blur(1.5px);
          opacity: 0;
          transition: opacity 0.35s 0.25s;
        }
        .door-scene.open .door-seam {
          opacity: 1;
        }
        .glass-door {
          position: absolute;
          inset: 0;
          z-index: 5;
          transform-origin: left center;
          transform: rotateY(0);
          transition: transform 1.35s cubic-bezier(0.55, 0.06, 0.2, 1);
          backface-visibility: hidden;
          background: linear-gradient(
            118deg,
            rgba(18, 24, 38, 0.9) 0%,
            rgba(30, 42, 64, 0.82) 42%,
            rgba(12, 18, 30, 0.93) 100%
          );
          border-right: 2px solid rgba(150, 180, 230, 0.28);
          box-shadow:
            inset 0 0 90px rgba(0, 0, 0, 0.6),
            inset 0 0 3px rgba(180, 210, 255, 0.35);
        }
        .glass-door::before {
          content: "";
          position: absolute;
          top: -25%;
          left: -25%;
          width: 55%;
          height: 150%;
          transform: rotate(7deg);
          background: linear-gradient(
            105deg,
            transparent,
            rgba(200, 222, 255, 0.08) 46%,
            rgba(200, 222, 255, 0.02) 56%,
            transparent
          );
        }
        .glass-door::after {
          content: "";
          position: absolute;
          right: 20px;
          top: 36%;
          height: 26%;
          width: 9px;
          border-radius: 6px;
          background: linear-gradient(#eef3f9, #95a6bd);
          box-shadow:
            0 0 12px rgba(255, 255, 255, 0.35),
            0 2px 6px rgba(0, 0, 0, 0.55);
        }
        .door-welcome {
          position: absolute;
          left: 50%;
          top: 22%;
          transform: translate(-50%, calc(-100% - 86px));
          z-index: 12;
          text-align: center;
          white-space: nowrap;
          pointer-events: none;
          color: #eef3fb;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-shadow:
            0 0 14px rgba(0, 0, 0, 0.85),
            0 0 20px rgba(255, 90, 20, 0.3);
        }
        .door-below {
          position: absolute;
          left: 50%;
          top: 22%;
          transform: translate(-50%, 84px);
          z-index: 12;
          text-align: center;
          pointer-events: none;
        }
        .door-tothe {
          color: #dfe7f2;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 1px;
          text-shadow: 0 0 12px rgba(0, 0, 0, 0.85);
        }
        .door-foxpit {
          margin-top: 2px;
          /* LockIn brand orange — same accent (#FF3B00) as the wordmark "Lock"
             and the coin count (Tailwind accent.DEFAULT / .dot.active here). */
          color: #ff3b00;
          /* Scales down for longer brand names ("Winner's Lounge") and wraps
             centered instead of clipping; "Fox Pit" still sits on one line. */
          font-size: clamp(30px, 12vw, 46px);
          font-weight: 900;
          line-height: 1.02;
          letter-spacing: 0.5px;
          max-width: 86vw;
          text-shadow:
            0 0 16px rgba(0, 0, 0, 0.85),
            0 0 24px rgba(255, 90, 20, 0.4);
        }
        .door-crest-img {
          position: absolute;
          left: 50%;
          top: 22%;
          transform: translate(-50%, -50%);
          width: 118px;
          z-index: 10;
          opacity: 1;
          filter: drop-shadow(0 0 22px rgba(255, 90, 20, 0.55));
        }
        .door-crest-tint {
          position: absolute;
          left: 50%;
          top: 22%;
          transform: translate(-50%, -50%);
          width: 118px;
          height: 117px;
          z-index: 11;
          background: rgba(24, 32, 50, 0.55);
          pointer-events: none;
          -webkit-mask: url("/foxpit/emblem-fox-neon.png") center / contain no-repeat;
          mask: url("/foxpit/emblem-fox-neon.png") center / contain no-repeat;
        }
        .door-scene.open .glass-door {
          transform: rotateY(-118deg);
        }
        .intro-skip {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 22px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          z-index: 20;
          letter-spacing: 0.08em;
        }
      `}</style>
    </div>
  );
}
