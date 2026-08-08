"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { stripMarkdown, type ChatMessage } from "@/lib/ai/chat";
import { type TutorialMode } from "@/lib/tutorial/tutorials";
import { startStt, sttSupported, type SttHandle } from "@/lib/speech";
import { MicIcon, SendIcon } from "./navIcons";
import { ChipDock } from "./ChipDock";
import { championshipChipsForMode, chipAnswer, type ChampionshipChip } from "@/lib/championship/copy";
import { autosizeTextarea } from "@/lib/dom/autosize";

/** A transcript message; `href` renders a follow link under the bubble (championship chip answers). */
type UiMessage = ChatMessage & { href?: string };

/**
 * THE LOCKSMITH CHAT — ONE canonical component, rendered on the full-screen Locksmith screen AND
 * inside the FAB sheet (architect ruling L). Same contained hero (never a background-cover), same
 * ChipDock, same autosize textarea, same MicIcon + paper-plane SendIcon pair, same greeting source.
 *
 * The container (full-screen vs sheet) and dismissal live in the PARENT. Everything inside — the
 * chat, its hero, its chips, its input — is this component. `compact` is the single size prop the
 * ruling allows for the sheet; `headerCta` is the tutorial's START PLAYING slot (absent in the FAB).
 */
export function LocksmithChat({
  mode,
  seed,
  steps,
  greeting,
  autoWalkthrough = false,
  compact = false,
  headerCta,
  onDismiss,
  dismissLabel = "Close",
}: {
  mode: TutorialMode;
  /** Seed prompt that governs follow-up Q&A (prepended as the first user turn). */
  seed: string;
  /** Pinned walkthrough beats (advanced). When present they ARE the walkthrough — no model improv. */
  steps?: string[];
  /** Initial assistant bubble when there's no pinned walkthrough / auto-walkthrough (the FAB). */
  greeting?: string;
  /** Stream a live walkthrough from `seed` on open (tutorial modes without pinned steps). */
  autoWalkthrough?: boolean;
  compact?: boolean;
  headerCta?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const chips = championshipChipsForMode(mode);
  const [messages, setMessages] = useState<UiMessage[]>(() =>
    steps && steps.length
      ? steps.map((s) => ({ role: "assistant", content: s }))
      : greeting
        ? [{ role: "assistant", content: greeting }]
        : [],
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeightPx = parseFloat(cs.lineHeight) || 20;
    const paddingYPx = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const { heightPx, overflowY } = autosizeTextarea({ scrollHeight: el.scrollHeight, lineHeightPx, paddingYPx, maxLines: 4 });
    el.style.height = `${heightPx}px`;
    el.style.overflowY = overflowY;
    el.scrollTop = el.scrollHeight;
  }
  useEffect(() => {
    autoGrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Speech-to-text (native plugin, web fallback). Availability detected at runtime.
  const [sttOk, setSttOk] = useState(false);
  const [listening, setListening] = useState(false);
  const sttRef = useRef<SttHandle | null>(null);
  useEffect(() => {
    let live = true;
    void sttSupported().then((ok) => live && setSttOk(ok));
    return () => {
      live = false;
      sttRef.current?.stop();
    };
  }, []);

  async function toggleMic() {
    if (listening) {
      sttRef.current?.stop();
      sttRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    const handle = await startStt(
      (t) => setInput(t),
      () => {
        setListening(false);
        sttRef.current = null;
      },
    );
    if (handle) sttRef.current = handle;
    else setListening(false);
  }

  // Auto-start the live walkthrough ONCE (only when there are no pinned steps).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (autoWalkthrough && !(steps && steps.length)) void stream([{ role: "user", content: seed }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a NEW message from ITS TOP; never yank to the bottom while a message streams.
  const prevCount = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > prevCount.current) {
      const last = el.lastElementChild as HTMLElement | null;
      el.scrollTop = last ? Math.max(0, last.offsetTop - 8) : 0;
    }
    prevCount.current = messages.length;
  }, [messages]);

  async function stream(apiHistory: ChatMessage[]) {
    setPending(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory }),
      });
      if (!res.ok || !res.body) throw new Error("request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
      if (!acc) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "I couldn't load that just now — but ask me anything and I'll help." };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Something went wrong — ask me anything and I'll help." };
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    const visible = messages.filter((m) => m.content);
    const apiHistory: ChatMessage[] = [
      { role: "user", content: seed },
      ...visible.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void stream(apiHistory);
  }

  // A dock chip sends its question. Championship answers are DATA (deterministic, no unset numbers)
  // and link to the rules page — the Locksmith never states a value that isn't set.
  function onPickChip(chip: ChampionshipChip) {
    if (pending) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: chip.q },
      { role: "assistant", content: chipAnswer(chip), href: "/app/championship" },
    ]);
  }

  const topInset = "env(safe-area-inset-top, 0px)";
  const heroExpanded = compact ? "30vh" : "52vh";

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-card">
      {/* HERO — CONTAINED (object-contain), never a background-cover. Corridor backdrop behind her. */}
      <div
        className="relative z-10 shrink-0 overflow-hidden"
        style={{ height: collapsed ? `calc(${topInset} + 7rem)` : heroExpanded }}
      >
        {!collapsed && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/foxpit/lounge/elevator_corridor.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 18%" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/foxpit/locksmith/locksmith_desk_clean.png"
              alt="The Locksmith at her desk"
              className="absolute bottom-0 left-1/2 h-full w-[90%] -translate-x-1/2 object-contain object-bottom"
              style={{ paddingTop: `calc(${topInset} + ${compact ? "3.5rem" : "6.5rem"})` }}
            />
          </>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 z-20 rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/80"
            style={{ top: `calc(${topInset} + 0.55rem)` }}
          >
            {dismissLabel}
          </button>
        )}

        <div className="absolute inset-x-0 z-20 px-5" style={{ top: `calc(${topInset} + 1.85rem)` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">The Locksmith</p>
          <div className="mt-0.5 flex items-start justify-between">
            <div className="flex flex-col items-start">
              <p className="whitespace-nowrap text-xl font-semibold leading-none text-white">Your fox guide</p>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Show the Locksmith" : "Hide the Locksmith"}
                aria-expanded={!collapsed}
                className="mt-1.5 text-[color:var(--brand-orange)]"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} aria-hidden>
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
            </div>
            {headerCta}
          </div>
        </div>
      </div>

      {/* CHIP DOCK — docked under the hero, above the transcript; persists through minimize. */}
      <ChipDock chips={chips} onPick={onPickChip} />

      {/* Transcript — framed low-opacity panel, image layered above. */}
      <div ref={scrollRef} className="z-0 mx-3 mt-1 mb-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-surface px-5 py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            <div className={"max-w-[17.5rem] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed " + (m.role === "user" ? "bg-accent-soft text-foreground" : "border border-border bg-surface text-foreground")}>
              {(m.role === "assistant" ? stripMarkdown(m.content) : m.content) || (pending ? "…" : "")}
              {m.href && (
                <Link href={m.href} className="mt-1.5 block text-[13px] font-semibold text-[color:var(--brand-orange)] underline-offset-2 hover:underline">
                  Open the Championship ›
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input · mic (MicIcon) · paper-plane send. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 items-end gap-1.5 border-t border-border px-3 pt-3"
        style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
      >
        <textarea
          ref={taRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask the Locksmith…"
          className="min-h-[40px] min-w-0 flex-1 resize-none self-end overflow-y-hidden rounded-2xl border border-border bg-surface px-4 py-2 text-sm leading-[1.4] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
        />
        <button
          type="button"
          onClick={toggleMic}
          disabled={!sttOk}
          aria-label={!sttOk ? "Voice input unavailable" : listening ? "Stop voice input" : "Start voice input"}
          title={sttOk ? "Voice input" : "Install the latest app build to use voice input"}
          className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full border disabled:opacity-40 " + (listening ? "border-loss/50 bg-loss/15 text-loss" : "border-border text-muted")}
        >
          <MicIcon />
        </button>
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-soft text-accent disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
