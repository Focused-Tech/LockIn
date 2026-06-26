import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getAnthropic, AI_MODEL } from "@/lib/ai/client";
import { buildSystemPrompt, MAX_CHAT_HISTORY, type ChatMessage } from "@/lib/ai/chat";
import { fetchUserChatContext } from "@/server/data/userStats";

/** Anthropic + firebase-admin both need the Node.js runtime. */
export const runtime = "nodejs";

/**
 * Streaming chat assistant. Auth-gated; injects a LockIn knowledge base + the
 * player's own data as the system prompt, then streams Claude's reply as plain
 * text chunks (read incrementally by the client widget).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    messages?: unknown;
  };

  // Sanitize history: valid roles + non-empty string content, bounded length,
  // must begin with a user turn.
  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === "object" &&
            ((m as ChatMessage).role === "user" ||
              (m as ChatMessage).role === "assistant") &&
            typeof (m as ChatMessage).content === "string" &&
            (m as ChatMessage).content.trim().length > 0,
        )
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
        .slice(-MAX_CHAT_HISTORY)
    : [];

  while (messages.length > 0 && messages[0]!.role === "assistant") {
    messages.shift();
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
  }

  const context = await fetchUserChatContext(adminDb(), user.uid);
  const system = buildSystemPrompt(context);

  const anthropicStream = getAnthropic().messages.stream({
    model: AI_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch {
        controller.error(new Error("stream failed"));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
