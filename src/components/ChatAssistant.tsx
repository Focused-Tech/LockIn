"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/ai/chat";

const GREETING =
  "Hey! I'm your LockIn assistant. Ask me about how contests work, your balance, deposits, or anything else.";

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");

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

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open assistant"
        className="fixed bottom-[4.5rem] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-ai shadow-lg backdrop-blur transition-colors hover:bg-[rgba(59,139,255,0.25)]"
      >
        {open ? "✕" : "AI"}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[8.5rem] right-4 z-40 flex h-[24rem] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(59,139,255,0.15)] text-xs font-bold text-ai">
              AI
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">LockIn assistant</p>
              <p className="text-xs text-muted">Here to help</p>
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
                  {m.content || (pending ? "…" : "")}
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
