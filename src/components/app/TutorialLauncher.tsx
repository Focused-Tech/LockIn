"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/ai/chat";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";
import { markTutorialSeen } from "@/app/app/tutorial/actions";
import { startStt, sttSupported, type SttHandle } from "@/lib/speech";
import { stripMarkdown } from "@/lib/ai/chat";
import { SendIcon } from "./navIcons";
import { ChipDock } from "./ChipDock";
import { championshipChipsForMode, chipAnswer, type ChampionshipChip } from "@/lib/championship/copy";
import { autosizeTextarea } from "@/lib/dom/autosize";

/** A transcript message; `href` renders a follow link under the bubble (championship chip answers). */
type UiMessage = ChatMessage & { href?: string };

/** Mic glyph — inline SVG, 1.75 stroke, currentColor. A plain mic; the button's disabled state
 *  (dimmed) signals unavailable, and the listening state colours it — no misleading strike. */
function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

/**
 * TUTORIAL — the Locksmith WALKS YOU THROUGH your chosen journey. On open she streams a guided
 * walkthrough (seeded by the mode's `intro`, answered live from her AI knowledge base), and you can
 * ask her anything. You START PLAYING by stepping through the little portal DOOR over her shoulder
 * (the same mini-door from the Fox Pit lobby) — or the "Start playing" text beside the title.
 *
 * Fires once per mode (per-user seen record; version bump re-offers). In onboarding it advances into
 * the app on finish (onDone); in-app it dismisses.
 */
export function TutorialLauncher({
  mode,
  initialSeen,
  onDone,
}: {
  mode: TutorialMode;
  initialSeen: boolean;
  onDone?: () => void;
}) {
  const slot = TUTORIALS[mode];
  const chips = championshipChipsForMode(mode);
  const [dismissed, setDismissed] = useState(initialSeen);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  // Auto-grow the message box: one line → max 4 lines → then scroll internally (no visible
  // scrollbar). Geometry is the pure autosizeTextarea(); we set overflow-y so the tail is REACHABLE
  // and scroll to the end so it's never clipped. Run on EVERY value change (typing, STT, chips).
  function autoGrow() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeightPx = parseFloat(cs.lineHeight) || 20;
    const paddingYPx = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const { heightPx, overflowY } = autosizeTextarea({
      scrollHeight: el.scrollHeight,
      lineHeightPx,
      paddingYPx,
      maxLines: 4,
    });
    el.style.height = `${heightPx}px`;
    el.style.overflowY = overflowY;
    el.scrollTop = el.scrollHeight;
  }
  useEffect(() => {
    autoGrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // Speech-to-text (native plugin, web fallback). Availability is detected at runtime.
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

  // Auto-start the guided walkthrough once (seed = the mode's intro prompt; she answers live).
  useEffect(() => {
    if (started.current || dismissed) return;
    started.current = true;
    void stream([{ role: "user", content: slot.intro }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  if (dismissed) return null;

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
          next[next.length - 1] = {
            role: "assistant",
            content: "I couldn't load that just now — but ask me anything and I'll walk you through it.",
          };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong loading the walkthrough — ask me anything and I'll help.",
        };
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
    if (taRef.current) taRef.current.style.height = "auto"; // collapse back to one line
    const visible = messages.filter((m) => m.content);
    const apiHistory: ChatMessage[] = [
      { role: "user", content: slot.intro },
      ...visible,
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void stream(apiHistory);
  }

  // A dock chip sends its question as the user's message. Championship answers are DATA (deterministic,
  // no unset numbers) and link to the rules page — the Locksmith never states a value that isn't set.
  function onPickChip(chip: ChampionshipChip) {
    if (pending) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: chip.q },
      { role: "assistant", content: chipAnswer(chip), href: "/app/championship" },
    ]);
  }

  // START PLAYING / SKIP both end the tutorial after she's walked you through. Never trap: persist in
  // the background; in onboarding advance after the write (2s cap) so the app layout won't re-offer.
  function finish() {
    if (finishing) return;
    setFinishing(true);
    const persist = markTutorialSeen(mode).catch(() => {});
    if (onDone) {
      void Promise.race([persist, new Promise((r) => setTimeout(r, 2000))]).then(() => onDone());
    } else {
      setDismissed(true);
    }
  }

  const topInset = "env(safe-area-inset-top, 0px)";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-card">
      {/* HERO — she's dropped DOWN (object-bottom + top padding) so the title clears her head; the
          portal door over her shoulder starts play. */}
      <div
        className="relative z-10 shrink-0 overflow-hidden"
        style={{ height: collapsed ? `calc(${topInset} + 7rem)` : "52vh" }}
      >
        {!collapsed && (
          <>
            {/* Elevator-corridor backdrop — she sits at her hostess desk in front of it (like walking
                into a restaurant). object-cover fills; positioned so the brass archway sits behind
                her head and the marble floor runs in front of the desk. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/foxpit/lounge/elevator_corridor.png"
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: "center 18%" }}
            />
            {/* The Locksmith at her desk — foreground, a touch smaller so the corridor reads as depth
                behind her (proportion of a host stand a few steps into the room). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/foxpit/locksmith/locksmith_desk_clean.png"
              alt="The Locksmith at her desk"
              className="absolute bottom-0 left-1/2 h-full w-[90%] -translate-x-1/2 object-contain object-bottom"
              style={{ paddingTop: `calc(${topInset} + 6.5rem)` }}
            />
          </>
        )}

        {/* Skip — small, top-right corner. */}
        <button
          type="button"
          onClick={finish}
          className="absolute right-4 z-20 rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/80"
          style={{ top: `calc(${topInset} + 0.55rem)` }}
        >
          Skip
        </button>

        {/* Eyebrow + title + collapse chevron (left) · "Start / Playing" link + portal door (right). */}
        <div className="absolute inset-x-0 z-20 px-5" style={{ top: `calc(${topInset} + 1.85rem)` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {slot.modeLabel} · How to play
          </p>
          <div className="mt-0.5 flex items-start justify-between">
            <div className="flex flex-col items-start">
              <p className="whitespace-nowrap text-xl font-semibold leading-none text-white">The Locksmith</p>
              {/* Brand-orange chevron — collapses/expands the hero backdrop + door. The "Start Playing"
                  link stays put in both states; the collapsed bar keeps a safe area below the chevron. */}
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Show the Locksmith" : "Hide the Locksmith"}
                aria-expanded={!collapsed}
                className="mt-1.5 text-[color:var(--brand-orange)]"
              >
                <svg
                  width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}
                  aria-hidden
                >
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </button>
            </div>

            {/* "Start Playing" — the SOLE start CTA (the floating portal door was removed). Always
                visible (even collapsed) so the start-play hook never disappears; same function. */}
            <button
              type="button"
              onClick={finish}
              className="text-center text-[13px] font-bold uppercase leading-[1.05] tracking-[0.06em] text-[color:var(--brand-orange)] underline-offset-2 hover:underline"
            >
              Start
              <br />
              Playing
            </button>
          </div>
        </div>
      </div>

      {/* CHIP DOCK — docked at the bottom edge of the desk image (below the image, above the
          transcript). Always rendered, so it stays visible when the desk image is minimized. */}
      <ChipDock chips={chips} onPick={onPickChip} />

      {/* Thread — her walkthrough + your questions. min-h-0 lets a flex-1 column actually SCROLL.
          Always an inset, rounded, low-opacity-bordered panel so the chat is cleanly framed off the
          image in every state — the image (hero, z-10) sits above it, the frame's soft border sits
          just below. Same treatment holds when the input focus shrinks the layout, and when collapsed. */}
      <div
        ref={scrollRef}
        className="z-0 mx-3 mt-1 mb-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-surface px-5 py-4"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end" : "self-start"}>
            <div
              className={
                "max-w-[17.5rem] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed " +
                (m.role === "user"
                  ? "bg-accent-soft text-foreground"
                  : "border border-border bg-surface text-foreground")
              }
            >
              {(m.role === "assistant" ? stripMarkdown(m.content) : m.content) || (pending ? "…" : "")}
              {m.href && (
                <Link
                  href={m.href}
                  className="mt-1.5 block text-[13px] font-semibold text-[color:var(--brand-orange)] underline-offset-2 hover:underline"
                >
                  Open the Championship ›
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ask her anything — input · mic (STT) · Send. The mic uses the native speech plugin (web
          fallback); the compact row keeps Send on-screen. */}
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
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow();
          }}
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
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border disabled:opacity-40 " +
            (listening ? "border-loss/50 bg-loss/15 text-loss" : "border-border text-muted")
          }
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
