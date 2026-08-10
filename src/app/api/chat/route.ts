import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/client";
import { buildSystemPrompt, MAX_CHAT_HISTORY, type ChatMessage } from "@/lib/ai/chat";
import { fetchUserChatContext } from "@/server/data/userStats";
import { evaluateLocksmithText, type GuardCategory } from "@/lib/locksmith/guard";
import {
  LOCKSMITH_FALLBACK_RESTRICTED,
  LOCKSMITH_FALLBACK_UNKNOWN,
} from "@/lib/locksmith/copy";
import { COLLECTIONS } from "@/lib/firebase/types";

/** Anthropic + firebase-admin both need the Node.js runtime. */
export const runtime = "nodejs";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

/** Every reply (real or fallback) leaves as plain text so the client's stream reader is unchanged. */
function reply(text: string): Response {
  return new Response(text, { headers: TEXT_HEADERS });
}

/**
 * Append a guard block to the moderation ledger (server-only, append-only). Best-effort — logging
 * must never break the player's reply. Message + trimmed context are kept so a reviewer sees cause.
 */
async function recordBlock(
  uid: string,
  direction: "input" | "output",
  category: GuardCategory | null,
  message: string,
  context: ChatMessage[],
): Promise<void> {
  try {
    await adminDb()
      .collection(COLLECTIONS.locksmithReports)
      .add({
        kind: "auto_block",
        direction,
        category,
        message: message.slice(0, 2000),
        context: context.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 500) })),
        reason: null,
        userId: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch {
    /* moderation logging is best-effort — never let it break the chat */
  }
}

/**
 * Guarded chat assistant. The system prompt constrains the model; this route ENFORCES it on both
 * sides. INPUT: a prompt seeking restricted content is blocked before the model call and recorded.
 * OUTPUT: the reply is BUFFERED (never streamed partial) so the guard can veto the whole thing — a
 * blocked reply returns the fallback, never a truncated answer. She never names the refused category.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };

  // Sanitize history: valid roles + non-empty string content, bounded, must begin with a user turn.
  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === "object" &&
            ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
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

  // ── INPUT GUARD ──────────────────────────────────────────────────────────────
  // The newest user turn is the one to screen. A prompt seeking restricted content never reaches
  // the model — it's recorded and answered with the fallback (she never says what was refused).
  const lastUser = messages[messages.length - 1]!;
  const inVerdict = evaluateLocksmithText(lastUser.content);
  if (inVerdict.blocked) {
    await recordBlock(user.uid, "input", inVerdict.category, lastUser.content, messages);
    return reply(LOCKSMITH_FALLBACK_RESTRICTED);
  }

  const context = await fetchUserChatContext(adminDb(), user.uid);
  const system = buildSystemPrompt(context);

  // ── MODEL (buffered) ─────────────────────────────────────────────────────────
  // Buffer the whole reply. Streaming deltas would let restricted text reach the player before the
  // guard could veto it; the requirement is "never a partial", so we generate fully, then screen.
  let text = "";
  try {
    const msg = await getAnthropic().messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system,
      messages,
    });
    text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
  } catch {
    return reply(LOCKSMITH_FALLBACK_UNKNOWN);
  }

  // ── OUTPUT GUARD ─────────────────────────────────────────────────────────────
  const outVerdict = evaluateLocksmithText(text);
  if (outVerdict.blocked) {
    await recordBlock(user.uid, "output", outVerdict.category, text, messages);
    return reply(LOCKSMITH_FALLBACK_RESTRICTED);
  }
  if (!text) return reply(LOCKSMITH_FALLBACK_UNKNOWN);

  return reply(text);
}
