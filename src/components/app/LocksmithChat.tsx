"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { stripMarkdown, type ChatMessage } from "@/lib/ai/chat";
import { type TutorialMode } from "@/lib/tutorial/tutorials";
import { startStt, sttSupported, type SttHandle } from "@/lib/speech";
import { MicIcon, SendIcon, LOCKSMITH_BADGE_SRC } from "./navIcons";
import { ChipDock } from "./ChipDock";
import { championshipChipsForMode, chipAnswer, type ChampionshipChip } from "@/lib/championship/copy";
import { autosizeTextarea } from "@/lib/dom/autosize";

/** A transcript message; `href` renders a follow link under the bubble (championship chip answers). */
type UiMessage = ChatMessage & { href?: string };

/**
 * THE LOCKSMITH CHAT — ONE canonical FULL-SCREEN surface, rendered on the tutorial screen AND the FAB
 * (architect ruling A: no smaller drawer variant). Solid HEADER BAND (title/chevron/CTA/close live
 * here, never on the artwork — D); a CONTAINED hero image below it; the ChipDock; a conversation
 * transcript with speaker bubbles (Locksmith left + avatar badge, user right — C); the input row.
 * The chevron minimizes the hero image (the collapsed state), not the chat.
 */
export function LocksmithChat({
  mode,
  seed,
  steps,
  greeting,
  autoWalkthrough = false,
  headerCta,
  onDismiss,
  dismissLabel = "Close",
}: {
  mode: TutorialMode;
  seed: string;
  steps?: string[];
  greeting?: string;
  autoWalkthrough?: boolean;
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

  // OPEN at the START of the first message (N) — the seeded walkthrough/greeting must not scroll to
  // the last step. After mount, a genuinely NEW message shows from ITS top; streaming never yanks down.
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevCount.current === null) {
      el.scrollTop = 0;
    } else if (messages.length > prevCount.current) {
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

  function onPickChip(chip: ChampionshipChip) {
    if (pending) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: chip.q },
      { role: "assistant", content: chipAnswer(chip), href: "/app/championship" },
    ]);
  }

  const topInset = "env(safe-area-inset-top, 0px)";

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-card">
      {/* HEADER BAND (D) — solid; nothing readable sits on the artwork. */}
      <div
        className="z-20 flex shrink-0 items-start justify-between gap-3 bg-surface-card px-5 pb-2"
        style={{ paddingTop: `calc(${topInset} + 0.9rem)` }}
      >
        <div className="flex flex-col items-start">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">The Locksmith</p>
          <p className="whitespace-nowrap text-xl font-semibold leading-none text-foreground">Your fox guide</p>
        </div>
        <div className="flex items-center gap-3 pt-0.5">
          {headerCta}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
              {dismissLabel}
            </button>
          )}
        </div>
      </div>

      {/* HERO IMAGE — CONTAINED (object-contain), no text on it; collapses to nothing when minimized. */}
      {!collapsed && (
        <div className="relative z-10 shrink-0 overflow-hidden" style={{ height: "42vh" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/foxpit/lounge/elevator_corridor.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 18%" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/foxpit/locksmith/locksmith_desk_clean.png" alt="The Locksmith at her desk" className="absolute bottom-0 left-1/2 h-full w-[92%] -translate-x-1/2 object-contain object-bottom" />
        </div>
      )}

      {/* PULL-TAB (K) — the collapse handle lives on the SEAM between the artwork and the chip dock,
          centred, not on the title row. 44px tap target; rotates for collapsed/expanded; stays
          reachable when the image is collapsed (it's outside the image conditional). */}
      <div className="relative z-20 flex shrink-0 justify-center" style={{ marginTop: collapsed ? 0 : "-16px" }}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Show the Locksmith" : "Hide the Locksmith"}
          aria-expanded={!collapsed}
          className="flex items-center justify-center"
          style={{ height: 44, width: 96 }}
        >
          <span className="flex h-[22px] w-[68px] items-center justify-center rounded-full border border-border bg-surface-card shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} aria-hidden>
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </button>
      </div>

      {/* CHIP DOCK — docked under the hero, above the transcript; persists through minimize. */}
      <ChipDock chips={chips} onPick={onPickChip} />

      {/* TRANSCRIPT — speaker bubbles (C): Locksmith left + avatar badge, user right, no avatar. */}
      <div ref={scrollRef} className="z-0 mx-3 mt-1 mb-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-surface px-3 py-4">
        {messages.map((m, i) => {
          const sameAsPrev = i > 0 && messages[i - 1]!.role === m.role;
          if (m.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-soft px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground">
                  {m.content}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={"flex items-start gap-2 " + (sameAsPrev ? "mt-[-2px]" : "")}>
              {/* avatar badge (the bottom-nav asset) — reserved space keeps grouped bubbles aligned. */}
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border" style={{ visibility: sameAsPrev ? "hidden" : "visible" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOCKSMITH_BADGE_SRC} alt="Locksmith" className="h-full w-full object-cover" />
              </div>
              <div className="max-w-[80%]">
                <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-surface-card px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground">
                  {stripMarkdown(m.content) || (pending ? "…" : "")}
                </div>
                {m.href && (
                  <Link href={m.href} className="mt-1.5 block text-[13px] font-semibold text-[color:var(--brand-orange)] underline-offset-2 hover:underline">
                    Open the Championship ›
                  </Link>
                )}
              </div>
            </div>
          );
        })}
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
