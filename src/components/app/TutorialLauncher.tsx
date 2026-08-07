"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/ai/chat";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";
import { markTutorialSeen } from "@/app/app/tutorial/actions";

/**
 * TUTORIAL — the Locksmith actually WALKS YOU THROUGH your chosen journey. On open she streams a
 * guided walkthrough (seeded by the mode's `intro`, answered live from her AI knowledge base — no
 * hardcoded rules), and you can ask her anything before you start. "Start playing" ends it.
 *
 * Fires once per mode (per-user seen record; version bump re-offers). In onboarding it advances into
 * the app on finish (onDone); in-app it just dismisses.
 */

// Minimal Web Speech API shapes (STT for the mic).
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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
  const [messages, setMessages] = useState<ChatMessage[]>([]); // display thread (starts with her walkthrough)
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // STT mic
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [sttAvailable, setSttAvailable] = useState(false);

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

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    setSttAvailable(typeof (w.SpeechRecognition ?? w.webkitSpeechRecognition) === "function");
  }, []);

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
    // API history: the hidden intro seed + the visible exchange so far + this new question.
    const visible = messages.filter((m) => m.content);
    const apiHistory: ChatMessage[] = [
      { role: "user", content: slot.intro },
      ...visible,
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    void stream(apiHistory);
  }

  function toggleMic() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i]?.[0]?.transcript ?? "";
      setInput(t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  // Skip and Start both END the tutorial — but only AFTER she's walked you through (she's on-screen
  // the whole time). Never trap: persist in the background; in onboarding advance after the write
  // (2s cap) so the app layout won't re-offer it.
  function finish() {
    setFinishing(true);
    const persist = markTutorialSeen(mode).catch(() => {});
    if (onDone) {
      void Promise.race([persist, new Promise((r) => setTimeout(r, 2000))]).then(() => onDone());
    } else {
      setDismissed(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-card">
      {/* Her at her desk — the BIG hero (like the approved full-screen screen): object-contain +
          object-bottom so she sits low and fills the frame, with the title overlaid on the empty
          space above her head (no overlap with her face). Padded beneath so she never abuts the
          chat — there's a border between them. */}
      <div className="relative shrink-0 pb-4" style={{ height: "46vh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/foxpit/locksmith/locksmith_desk_clean.png"
          alt="The Locksmith at her desk"
          className="h-full w-full object-contain object-bottom"
        />
        <div
          className="absolute inset-x-0 top-0 flex items-start justify-between px-5"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.9rem)" }}
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {slot.modeLabel} · How to play
            </p>
            <p className="text-xl font-semibold text-white">The Locksmith</p>
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-full border border-white/25 px-3 py-1 text-xs font-medium text-white/80"
          >
            Skip
          </button>
        </div>
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
              {m.content || (pending ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {/* Ask her anything */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Locksmith…"
          className="h-10 flex-1 rounded-full border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
        />
        <button
          type="button"
          onClick={toggleMic}
          disabled={!sttAvailable}
          aria-label={sttAvailable ? (listening ? "Stop voice input" : "Start voice input") : "Voice input unavailable"}
          title={sttAvailable ? "Voice input" : "Voice input isn't available in this app yet"}
          className={
            "flex h-10 w-10 items-center justify-center rounded-full border disabled:opacity-40 " +
            (listening ? "border-loss/50 bg-loss/15 text-loss" : "border-border text-muted")
          }
        >
          <MicIcon on={listening} />
        </button>
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="h-10 rounded-full border border-accent-border bg-accent-soft px-4 text-sm font-semibold text-accent disabled:opacity-40"
        >
          Send
        </button>
      </form>

      {/* Start playing */}
      <div
        className="shrink-0 px-4 pt-1"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <button
          type="button"
          onClick={finish}
          disabled={finishing}
          className="w-full rounded-xl border border-accent-border bg-accent-soft px-4 py-3.5 text-sm font-semibold text-accent disabled:opacity-60"
        >
          {finishing ? "Starting…" : "Start playing"}
        </button>
      </div>
    </div>
  );
}
