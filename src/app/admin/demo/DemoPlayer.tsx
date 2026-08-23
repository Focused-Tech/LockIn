"use client";

import { useMemo, useState } from "react";
import type { DemoCategory, DemoHost } from "@/lib/demo/presentation";

/**
 * PRESENTATION PLAYER — the twelve-chapter walkthrough from
 * `design/lockin_cordell_demo_v2.html`, driven inside the phone frame so it demos the real product
 * shape rather than a slide deck.
 *
 * Data arrives as PROPS from the admin-gated server page. This component imports nothing from
 * `@/lib/demo/presentation` except its TYPES, which are erased at build, so no marquee name is ever
 * inlined into a client chunk — the names exist only in the RSC payload of a page that non-admins
 * receive a 404 for.
 *
 * Controls mirror the reference: category, host, chapter prev/next, and a speed strip. There is no
 * auto-advance timer; a live pitch is paced by the person talking, not by a clock.
 */
const EDGE = "var(--edge, #1E2A38)";

export function DemoPlayer({
  script,
  chapters,
  speeds,
}: {
  script: DemoCategory[];
  chapters: { n: number; id: string; title: string }[];
  speeds: number[];
}) {
  const [catId, setCatId] = useState(script[0]?.id ?? "");
  const [hostId, setHostId] = useState(script[0]?.creators[0]?.id ?? "");
  const [chapter, setChapter] = useState(0);
  const [speed, setSpeed] = useState(1);

  const category = useMemo(() => script.find((c) => c.id === catId) ?? script[0], [script, catId]);
  const host: DemoHost | undefined = useMemo(
    () => category?.creators.find((h) => h.id === hostId) ?? category?.creators[0],
    [category, hostId],
  );

  const pickCategory = (id: string) => {
    const c = script.find((x) => x.id === id);
    setCatId(id);
    setHostId(c?.creators[0]?.id ?? "");
    setChapter(0);
  };

  const ch = chapters[chapter];
  const accent = category?.color ?? "var(--brand-orange)";
  const poolAt100 = host ? host.stake * 100 : 0;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide" style={{ color: accent }}>
          Presentation demo · admin only
        </p>
        <h1 className="text-xl font-semibold">{ch ? `${ch.n} · ${ch.title}` : "Demo"}</h1>
        <p className="text-sm text-muted">
          Chapter {chapter + 1} of {chapters.length} · one topic, three legs
        </p>
      </header>

      {/* CATEGORY STRIP */}
      <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {script.map((c) => {
          const on = c.id === category?.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCategory(c.id)}
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm"
              style={{
                borderColor: on ? c.color : EDGE,
                background: on ? `${c.color}22` : "transparent",
                color: on ? "#fff" : "#8b97a8",
              }}
            >
              <span aria-hidden>{c.emoji}</span> {c.name}
            </button>
          );
        })}
      </div>

      {/* HOST PICKER — only when the category seats more than one */}
      {category && category.creators.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {category.creators.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHostId(h.id)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{
                borderColor: h.id === host?.id ? accent : EDGE,
                color: h.id === host?.id ? "#fff" : "#8b97a8",
              }}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      {/* THE SLATE — one topic, three legs */}
      {host && (
        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: EDGE, borderLeft: `4px solid ${accent}` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: `${accent}22`, color: accent }}
            >
              {host.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{host.name}</p>
              <p className="truncate text-xs text-muted">
                {host.role} · {host.tier} reach
              </p>
            </div>
          </div>

          <h2 className="mt-4 text-lg font-semibold">{host.topic}</h2>
          <p className="text-sm text-muted">{host.subtitle}</p>

          <ol className="mt-4 flex flex-col gap-3">
            {host.legs.map((leg, i) => (
              <li key={i} className="rounded-xl border p-3" style={{ borderColor: EDGE }}>
                <p className="text-xs text-muted">Leg {i + 1}</p>
                <p className="mt-1 text-sm font-medium">{leg.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {leg.options.map((o) => (
                    <span
                      key={o}
                      className="rounded-full border px-2.5 py-1 text-xs"
                      style={{ borderColor: EDGE, color: "#c9d3e0" }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
                {leg.context && <p className="mt-2 text-xs text-muted">{leg.context}</p>}
              </li>
            ))}
          </ol>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Entry" value={`$${host.stake}`} />
            <Stat label="Host fee" value={`$${host.hostFee}`} />
            <Stat label="Pool at 100" value={`$${poolAt100.toLocaleString()}`} />
          </div>

          {host.caption && (
            <p
              className="mt-4 border-t pt-3 text-sm italic text-muted"
              style={{ borderColor: EDGE }}
            >
              {host.caption}
            </p>
          )}
        </section>
      )}

      {/* PRESENTER CONTROLS */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setChapter((c) => Math.max(0, c - 1))}
          disabled={chapter === 0}
          className="flex-1 rounded-xl border py-3 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: EDGE }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setChapter((c) => Math.min(chapters.length - 1, c + 1))}
          disabled={chapter === chapters.length - 1}
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: accent }}
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Speed</span>
        {speeds.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className="rounded-lg border px-2.5 py-1 text-xs"
            style={{
              borderColor: s === speed ? accent : EDGE,
              color: s === speed ? "#fff" : "#8b97a8",
            }}
          >
            {s}x
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setChapter(0);
            pickCategory(script[0]?.id ?? "");
          }}
          className="ml-auto rounded-lg border px-2.5 py-1 text-xs"
          style={{ borderColor: EDGE, color: "#8b97a8" }}
        >
          Replay
        </button>
      </div>

      <p className="text-xs text-muted">
        Not public. This walkthrough names real people and is reachable only by an owner account.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-2" style={{ borderColor: EDGE }}>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
