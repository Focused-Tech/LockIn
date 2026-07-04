"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * CHOOSE YOUR ARENA — the mode-selection carousel (design reference:
 * design/design-reference/arena-workflow-BASE.html). Ported faithfully into
 * React. Chrome (topbar/bottom nav) is supplied by AppFrame, so this ports only
 * the header + carousel + dots + toast.
 *
 * Carousel order (approved): Practice Dojo → Multi-Slate → Coliseum → Creator
 * Studio. data-mode names are unchanged from the design: practice / multiplayer
 * (Multi-Slate) / compete (Coliseum) / creator. NO lock/skip this pass — there
 * is no real progression gate designed. Live counts are decorative.
 */

type Mode = {
  key: "practice" | "multiplayer" | "compete" | "creator";
  tag: string;
  title: string;
  desc: string;
  meta: string[];
  cta: string;
  live: number;
  accent: string;
  border: string;
  fill: string;
  fillMask: string;
  bg: string;
  route: string;
};

const MASK_STD = "linear-gradient(180deg, #000 0%, #000 20%, transparent 48%)";

// Order matches the approved carousel: practice → multiplayer → compete → creator.
const MODES: Mode[] = [
  {
    key: "practice",
    tag: "Solo · No stakes",
    title: "Practice Dojo",
    desc: "Single slate. Sharpen your reads against AI creators — coaching hints, no coins.",
    meta: ["Hints on", "Single slate", "vs AI creators"],
    cta: "Start practicing →",
    live: 1247,
    accent: "#5dcaa5",
    border: "rgba(93, 202, 165, 0.55)",
    fill: "linear-gradient(90deg, #1c0900 0%, #3c1301 50%, #160701 100%)",
    fillMask: MASK_STD,
    bg: "/arena/arena-practice.png",
    route: "/app/practice/arena/dojo",
  },
  {
    key: "multiplayer",
    tag: "Solo · Stacked",
    title: "Multi-Slate",
    desc: "Queue several slates and play them back-to-back vs AI creators.",
    meta: ["Multiple slates", "Back-to-back", "vs AI creators"],
    cta: "Stack slates →",
    live: 14523,
    accent: "#378add",
    border: "rgba(55, 138, 221, 0.55)",
    fill: "linear-gradient(90deg, #050117 0%, #07042b 50%, #000539 100%)",
    fillMask: MASK_STD,
    bg: "/arena/arena-multislate.png",
    route: "/app/practice/arena/multi",
  },
  {
    key: "compete",
    tag: "Team · vs AI creator",
    title: "Coliseum",
    desc: "Rally a team by invite code and challenge the AI creator. Climb, grow the pot.",
    meta: ["Invite a team", "vs AI creator", "Leaderboard"],
    cta: "Enter Coliseum →",
    live: 3891,
    accent: "#e24b4a",
    border: "rgba(226, 75, 74, 0.55)",
    fill: "linear-gradient(90deg, #303842 0%, #5b7381 50%, #dad1bb 100%)",
    fillMask: MASK_STD,
    bg: "/arena/arena-coliseum.png",
    route: "/app/practice/arena/coliseum",
  },
  {
    key: "creator",
    tag: "Host · Build following",
    title: "Creator Studio",
    desc: "You are the creator. Invite followers to play your slates. Practice hosting.",
    meta: ["You host", "Followers join", "Sandbox"],
    cta: "Open studio →",
    live: 27418,
    accent: "#afa9ec",
    border: "rgba(175, 169, 236, 0.55)",
    fill: "linear-gradient(90deg, #0e0b0b 0%, #241217 50%, #422629 100%)",
    fillMask: "linear-gradient(180deg, #000 0%, #000 12%, transparent 26%)",
    bg: "/arena/arena-creator.png",
    route: "/app/practice/arena/studio",
  },
];

/** Remembers the last mode entered, so the carousel opens where you left off. */
const LAST_MODE_KEY = "lockin:arena:lastMode";

export function ArenaChooser() {
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const panelWidthRef = useRef(0);

  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [live, setLive] = useState<number[]>(() => MODES.map((m) => m.live));

  const applyTransform = useCallback((i: number, dragDelta = 0) => {
    const track = trackRef.current;
    const carousel = carouselRef.current;
    const pw = panelWidthRef.current;
    if (!track || !carousel || !pw) return;
    const offset = -i * pw + (carousel.offsetWidth - pw) / 2 + dragDelta;
    track.style.transform = `translateX(${offset}px)`;
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(MODES.length - 1, next));
      setIndex(clamped);
      applyTransform(clamped);
    },
    [applyTransform],
  );

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track || !track.firstElementChild) return;
      panelWidthRef.current = (
        track.firstElementChild as HTMLElement
      ).getBoundingClientRect().width;
      applyTransform(index);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decorative live-count ticker.
  useEffect(() => {
    const timers = MODES.map((_, i) =>
      setInterval(
        () =>
          setLive((prev) => {
            const n = [...prev];
            n[i] = (n[i] ?? 0) + Math.floor(Math.random() * 3) + 1;
            return n;
          }),
        3000 + i * 700,
      ),
    );
    return () => timers.forEach(clearInterval);
  }, []);

  function enter(mode: Mode) {
    try {
      window.localStorage.setItem(LAST_MODE_KEY, mode.key);
    } catch {
      /* storage disabled — non-fatal */
    }
    router.push(mode.route);
  }

  const drag = useRef({ active: false, startX: 0, currentX: 0 });
  function onDragStart(clientX: number) {
    drag.current = { active: true, startX: clientX, currentX: clientX };
    setDragging(true);
  }
  function onDragMove(clientX: number) {
    if (!drag.current.active) return;
    drag.current.currentX = clientX;
    applyTransform(index, clientX - drag.current.startX);
  }
  function onDragEnd() {
    if (!drag.current.active) return;
    const delta = drag.current.currentX - drag.current.startX;
    drag.current.active = false;
    setDragging(false);
    const pw = panelWidthRef.current || 1;
    if (Math.abs(delta) > pw * 0.15) goTo(index + (delta < 0 ? 1 : -1));
    else goTo(index);
  }

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => onDragMove(e.clientX);
    const up = () => onDragEnd();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, index]);

  return (
    <div className="chooser">
      <header className="ch-header">
        <div className="ch-title">Choose your arena</div>
        <div className="ch-subtitle">
          Swipe to pick how you want to play. Tap to enter.
        </div>
      </header>

      <div
        className="carousel"
        ref={carouselRef}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) onDragStart(t.clientX);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) onDragMove(t.clientX);
        }}
        onTouchEnd={onDragEnd}
        onMouseDown={(e) => {
          e.preventDefault();
          onDragStart(e.clientX);
        }}
      >
        <div className={"track" + (dragging ? " dragging" : "")} ref={trackRef}>
          {MODES.map((m, i) => {
            const active = i === index;
            const shade =
              m.key === "practice"
                ? "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 56%, rgba(8,9,12,0.72) 84%, rgba(8,9,12,0.95) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.15) 100%)";
            return (
              <div className="panel" key={m.key}>
                <div
                  className="card"
                  style={
                    {
                      borderColor: m.border,
                      "--tint-accent": m.accent,
                    } as React.CSSProperties
                  }
                  onClick={() => (active ? enter(m) : goTo(i))}
                >
                  <div
                    className="arena-blur"
                    style={{ backgroundImage: `url(${m.bg})` }}
                  />
                  <div
                    className="arena-fill"
                    style={{
                      background: m.fill,
                      WebkitMaskImage: m.fillMask,
                      maskImage: m.fillMask,
                    }}
                  />
                  <div
                    className="arena-bg"
                    style={{ backgroundImage: `url(${m.bg})` }}
                  />
                  <div className="content-shade" style={{ background: shade }} />

                  <div className="card-top-row">
                    <span className="mode-tag">
                      <span className="shield-mini" />
                      {m.tag}
                    </span>
                    <span className="spacer" />
                    <span className="follower-count">
                      <span className="follower-dot" />
                      <span className="follower-num">
                        {(live[i] ?? m.live).toLocaleString()}
                      </span>
                      <span className="follower-label">live</span>
                    </span>
                  </div>

                  <div className="mode-title">{m.title}</div>
                  <div className="mode-desc">{m.desc}</div>
                  <div className="stage-spacer" />

                  <div className="card-bottom">
                    <div className="meta">
                      {m.meta.map((c) => (
                        <span className="meta-chip" key={c}>
                          {c}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="cta"
                      onClick={(e) => {
                        e.stopPropagation();
                        enter(m);
                      }}
                    >
                      {m.cta}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dots">
        {MODES.map((m, i) => (
          <button
            key={m.key}
            type="button"
            aria-label={`Go to ${m.title}`}
            className={"dot" + (i === index ? " active" : "")}
            onClick={() => goTo(i)}
          />
        ))}
      </div>

      <style jsx>{`
        .chooser {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }
        .ch-header {
          padding: 12px 20px 8px;
          flex-shrink: 0;
        }
        .ch-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .ch-subtitle {
          font-size: 13px;
          color: #888780;
          margin-top: 2px;
        }
        .carousel {
          flex: 1;
          position: relative;
          overflow: hidden;
          padding: 12px 0;
          touch-action: pan-y;
          min-height: 0;
        }
        .track {
          display: flex;
          height: 100%;
          transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        .track.dragging {
          transition: none;
        }
        .panel {
          flex: 0 0 88%;
          padding: 0 8px;
          height: 100%;
        }
        .card {
          height: 100%;
          border-radius: 24px;
          padding: 18px 18px 16px;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
          border: 1.5px solid var(--tint-border, rgba(255, 255, 255, 0.2));
          cursor: pointer;
          transition: transform 0.2s ease;
          isolation: isolate;
        }
        .card:active {
          transform: scale(0.98);
        }
        .arena-blur {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: blur(30px) brightness(0.5) saturate(0.7);
          transform: scale(1.1);
        }
        .arena-bg {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          animation: ch-breathe 5s ease-in-out infinite;
        }
        @keyframes ch-breathe {
          0%,
          100% {
            filter: brightness(0.95) saturate(0.98);
          }
          50% {
            filter: brightness(1.08) saturate(1.04);
          }
        }
        .arena-fill {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .content-shade {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
        }
        .card > *:not(.arena-blur):not(.arena-fill):not(.arena-bg):not(.content-shade) {
          position: relative;
          z-index: 3;
        }
        .card-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mode-tag {
          flex: 0 1 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 5px 10px;
          border-radius: 999px;
          color: var(--tint-accent);
          background: color-mix(
            in oklab,
            var(--tint-accent) 20%,
            rgba(0, 0, 0, 0.5)
          );
          backdrop-filter: blur(6px);
          border: 1px solid
            color-mix(in oklab, var(--tint-accent) 40%, transparent);
          white-space: nowrap;
        }
        .shield-mini {
          width: 12px;
          height: 14px;
          background: url("/arena/icon-shield.png") center / contain no-repeat;
          display: inline-block;
          flex-shrink: 0;
        }
        .spacer {
          flex: 1;
        }
        .follower-count {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
          white-space: nowrap;
        }
        .follower-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--tint-accent);
          box-shadow: 0 0 6px var(--tint-accent);
          animation: ch-livepulse 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes ch-livepulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.8);
          }
        }
        .follower-num {
          font-size: 12px;
          font-weight: 800;
          color: white;
          font-variant-numeric: tabular-nums;
        }
        .follower-label {
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .mode-title {
          font-size: 26px;
          font-weight: 800;
          margin-top: 10px;
          letter-spacing: -0.5px;
          line-height: 1.1;
          text-shadow:
            0 2px 10px rgba(0, 0, 0, 1),
            0 0 24px rgba(0, 0, 0, 0.95),
            0 0 40px rgba(0, 0, 0, 0.7);
        }
        .mode-desc {
          font-size: 13.5px;
          color: rgba(240, 240, 232, 0.95);
          margin-top: 6px;
          line-height: 1.45;
          text-shadow:
            0 1px 8px rgba(0, 0, 0, 1),
            0 0 16px rgba(0, 0, 0, 0.95),
            0 0 28px rgba(0, 0, 0, 0.7);
        }
        .stage-spacer {
          flex: 1;
          min-height: 120px;
        }
        .card-bottom {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          min-height: 22px;
        }
        .meta-chip {
          font-size: 10.5px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.55);
          color: #e8e8e0;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(4px);
        }
        .cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          background: color-mix(
            in oklab,
            var(--tint-accent) 28%,
            rgba(0, 0, 0, 0.5)
          );
          border: 1.5px solid var(--tint-accent);
          color: white;
          cursor: pointer;
          transition:
            transform 0.15s,
            background 0.2s;
          backdrop-filter: blur(6px);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
          width: 100%;
          line-height: 1;
        }
        .cta:hover {
          background: color-mix(
            in oklab,
            var(--tint-accent) 40%,
            rgba(0, 0, 0, 0.35)
          );
        }
        .cta:active {
          transform: scale(0.97);
        }
        .dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 12px 0 6px;
          flex-shrink: 0;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s;
          border: none;
          padding: 0;
          cursor: pointer;
        }
        .dot.active {
          width: 20px;
          border-radius: 3px;
          background: #ff3b00;
        }
        @media (prefers-reduced-motion: reduce) {
          .track,
          .arena-bg,
          .follower-dot,
          .cta,
          .card,
          .dot {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}
