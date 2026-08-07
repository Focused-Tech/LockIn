"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { stripMarkdown, type ChatMessage } from "@/lib/ai/chat";
import { TUTORIALS, type TutorialMode } from "@/lib/tutorial/tutorials";

/** Best-effort mode for the screen the user is standing on (for contextual "How to play"). */
function pathnameToMode(pathname: string): TutorialMode {
  if (pathname.startsWith("/app/foxpit")) return "tower_boss";
  if (pathname.startsWith("/app/practice")) return "lone_fox";
  if (pathname.startsWith("/app/create") || pathname.startsWith("/app/creator")) return "creator";
  if (pathname.startsWith("/app/beginner")) return "beginner";
  return "advanced";
}

const GREETING =
  "I'm the Locksmith 🦊 — your fox guide to picking the lock on a win. Ask me how odds, parlays, or payouts work, about your balance or deposits, or anything else on LockIn.";

// Minimal Web Speech API shapes (the DOM lib doesn't ship these in this TS config).
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

/**
 * The Locksmith is contextual (§3d): she auto-appears (the FAB) only where a DECISION is being made
 * — slate detail while picking, the creator builder, practice, and tower play. She does NOT auto-show
 * on profile, wallet, settings, responsible play, leaderboard, refer, legal, or the agreement flow.
 * (The nav Locksmith slot can still open her from anywhere — that's the explicit help entry.)
 */
const DECISION_PREFIXES = ["/app/slate/", "/app/create", "/app/creator", "/app/practice", "/app/foxpit"];
const DECISION_DENY = ["/app/creator/agreement"];
function isDecisionScreen(pathname: string): boolean {
  if (DECISION_DENY.some((p) => pathname.startsWith(p))) return false;
  return DECISION_PREFIXES.some((p) => pathname.startsWith(p));
}

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  // §3b — the nav Locksmith slot (and any help entry point) opens THIS same Locksmith, reused.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("locksmith:open", openIt);
    return () => window.removeEventListener("locksmith:open", openIt);
  }, []);

  // §3c — speech-to-text. Uses the platform Web Speech API when the shell exposes it; when it does
  // NOT (this Capacitor WebView does not bundle a native STT plugin), the mic ships DISABLED with an
  // honest state rather than faked. Capability is detected at runtime (SSR-safe).
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [sttAvailable, setSttAvailable] = useState(false);
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    setSttAvailable(typeof Ctor === "function");
  }, []);

  function toggleMic() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return; // disabled state — never faked
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? "";
      setInput(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || pending) return;
    if (!overrideText) setInput("");

    const history = [...messages, { role: "user" as const, content: text }];
    // Show the user turn + an empty assistant turn we stream into.
    setMessages([...history, { role: "assistant", content: "" }]);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Drop the greeting (UI-only) so the payload starts with a user turn.
        body: JSON.stringify({ messages: history.slice(1) }),
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
            content: "Sorry — I couldn't respond just now. Try again?",
          };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Sorry — something went wrong. Please try again.",
        };
        return next;
      });
    } finally {
      setPending(false);
    }
  }

  // §3d — the FAB (auto-launcher) only appears where a decision is being made. The panel itself can
  // still be opened from anywhere via the nav Locksmith slot (locksmith:open), so we render the
  // launcher on decision screens OR whenever the panel is already open (to close it).
  const showFab = isDecisionScreen(pathname);
  if (!showFab && !open) return null;

  return (
    <>
      {/* Launcher */}
      {(showFab || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close Locksmith" : "Open Locksmith — your AI guide"}
          className="fixed bottom-[4.5rem] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-lg text-ai shadow-lg backdrop-blur transition-colors hover:bg-[rgba(59,139,255,0.25)]"
        >
          {open ? (
            "✕"
          ) : (
            // The architect-approved Locksmith FAB image (LOCKIN_GREENSCREEN_ASSETS/_INDEX.txt:
            // "locksmith_badge.png is the ONE the Locksmith FAB uses"). No more crops.
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/foxpit/locksmith/locksmith_badge.png" alt="" className="h-9 w-9 rounded-full object-cover" />
          )}
        </button>
      )}

      {/* Panel — her at her desk (§3a: reuse locksmith_desk.png) sits at the TOP. */}
      {open && (
        <div className="fixed bottom-[8.5rem] right-4 z-40 flex h-[26rem] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface-card shadow-2xl">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/foxpit/locksmith/locksmith_desk_clean.png"
              alt="The Locksmith at her desk"
              className="h-24 w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2 pt-6">
              <p className="text-sm font-semibold text-white">Locksmith</p>
              <p className="text-xs text-white/70">Your fox guide to the win</p>
              {/* §4 — permanent "How to play", contextual to the mode you're standing in. Triggers a
                  real, live walkthrough (same seed the tutorial uses), not a static blurb. */}
              <button
                type="button"
                disabled={pending}
                onClick={() => void send(TUTORIALS[pathnameToMode(pathname)].intro)}
                className="ml-auto rounded-full border border-white/30 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                How to play
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "self-end" : "self-start"}
              >
                <div
                  className={
                    "max-w-[15rem] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                    (m.role === "user"
                      ? "bg-accent-soft text-foreground"
                      : "border border-[rgba(59,139,255,0.25)] bg-[rgba(59,139,255,0.08)] text-foreground")
                  }
                >
                  {(m.role === "assistant" ? stripMarkdown(m.content) : m.content) || (pending ? "…" : "")}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="h-9 flex-1 rounded border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(59,139,255,0.4)]"
            />
            {/* §3c — speech-to-text mic. Enabled only when the platform exposes Web Speech; otherwise
                shipped DISABLED with an honest tooltip (this WebView has no native STT plugin). */}
            <button
              type="button"
              onClick={toggleMic}
              disabled={!sttAvailable}
              aria-label={
                !sttAvailable
                  ? "Voice input unavailable in this app"
                  : listening
                    ? "Stop voice input"
                    : "Start voice input"
              }
              title={sttAvailable ? "Voice input" : "Voice input isn't available in this app yet"}
              className={
                "flex h-9 w-9 items-center justify-center rounded border text-sm transition-colors disabled:opacity-40 " +
                (listening
                  ? "border-loss/50 bg-loss/15 text-loss"
                  : "border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-ai")
              }
            >
              <span aria-hidden>{listening ? "◉" : "🎤"}</span>
            </button>
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="h-9 rounded border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] px-3 text-sm font-medium text-ai disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
