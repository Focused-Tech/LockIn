"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ChatMessage } from "@/lib/ai/chat";

const GREETING =
  "I'm the Locksmith 🦊 — your fox guide to picking the lock on a win. Ask me how odds, parlays, or payouts work, about your balance or deposits, or anything else on LockIn.";

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

  // Keep the mode picker clean — hide the assistant on the arena chooser.
  if (pathname === "/app/practice/arena/chooser") return null;

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Locksmith" : "Open Locksmith — your AI guide"}
        className="fixed bottom-[4.5rem] right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(59,139,255,0.4)] bg-[rgba(59,139,255,0.15)] text-lg text-ai shadow-lg backdrop-blur transition-colors hover:bg-[rgba(59,139,255,0.25)]"
      >
        {open ? (
          "✕"
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/arena/fox-crest.png" alt="" className="h-9 w-9 rounded-full object-cover" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-[8.5rem] right-4 z-40 flex h-[24rem] w-[min(92vw,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[rgba(59,139,255,0.15)] text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/arena/fox-crest.png" alt="" className="h-full w-full rounded-full object-cover" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Locksmith</p>
              <p className="text-xs text-muted">Your fox guide to the win</p>
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
