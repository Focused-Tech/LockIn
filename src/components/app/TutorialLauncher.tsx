"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/ai/chat";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";
import { markTutorialSeen } from "@/app/app/tutorial/actions";
import { startStt, sttSupported, type SttHandle } from "@/lib/speech";
import { stripMarkdown } from "@/lib/ai/chat";

/** Mic glyph — inline SVG, 1.75 stroke, currentColor. Strike when off/unavailable. */
function MicIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      {!on && <path d="M4 4l16 16" />}
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
  const [dismissed, setDismissed] = useState(initialSeen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

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
    const visible = messages.filter((m) => m.content);
    const apiHistory: ChatMessage[] = [
      { role: "user", content: slot.intro },
      ...visible,
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void stream(apiHistory);
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
      <div className="relative shrink-0" style={{ height: "52vh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/locksmith/locksmith_desk_clean.png"
          alt="The Locksmith at her desk"
          className="h-full w-full object-contain object-bottom"
          style={{ paddingTop: `calc(${topInset} + 5rem)` }}
        />

        {/* Skip — small, top-right corner, above the title row (never overlaps Start playing). */}
        <button
          type="button"
          onClick={finish}
          className="absolute right-4 z-20 rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/80"
          style={{ top: `calc(${topInset} + 0.55rem)` }}
        >
          Skip
        </button>

        {/* Hero row: title (left) · "Start playing" (right, same row as the hero font). */}
        <div
          className="absolute inset-x-0 z-20 flex items-end justify-between px-5"
          style={{ top: `calc(${topInset} + 2.55rem)` }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {slot.modeLabel} · How to play
            </p>
            <p className="whitespace-nowrap text-xl font-semibold leading-none text-white">The Locksmith</p>
          </div>
          <button
            type="button"
            onClick={finish}
            className="shrink-0 whitespace-nowrap pb-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--brand-orange)]"
          >
            Start playing ▸
          </button>
        </div>

        {/* The DOOR — the Fox Pit lobby mini-door, small + distant, over her (screen-right) shoulder.
            Tapping it steps through and starts play. */}
        <button
          type="button"
          onClick={finish}
          aria-label="Start playing — step through the door"
          className="tut-door absolute z-10"
          style={{ right: "9%", top: "52%" }}
        >
          <div
            style={{
              width: 38,
              height: 56,
              borderRadius: "8px 8px 3px 3px",
              background: "linear-gradient(180deg, var(--brand-orange), rgba(252,62,1,.45))",
              border: "2px solid var(--brand-orange)",
              boxShadow: "0 0 18px rgba(252,62,1,.85), 0 8px 16px rgba(0,0,0,.6)",
              position: "relative",
              opacity: 0.92,
            }}
          >
            <div
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "rgba(255,255,255,.9)",
                transform: "translateY(-50%)",
              }}
            />
          </div>
        </button>
      </div>

      {/* Thread — her walkthrough + your questions. min-h-0 lets a flex-1 column actually SCROLL. */}
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-border px-5 py-4">
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
        className="flex shrink-0 items-center gap-1.5 border-t border-border px-3 pt-3"
        style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Locksmith…"
          className="h-10 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
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
          <MicIcon on={listening} />
        </button>
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="h-10 shrink-0 rounded-full border border-accent-border bg-accent-soft px-4 text-sm font-semibold text-accent disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
