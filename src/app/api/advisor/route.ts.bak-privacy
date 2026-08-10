import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { getAnthropic, ADVISOR_MODEL } from "@/lib/ai/client";
import { buildAdvisorSystemPrompt } from "@/lib/ai/advisor";
import { fetchUserChatContext } from "@/server/data/userStats";
import { fetchSlate } from "@/server/data/slates";

export const runtime = "nodejs";

/**
 * Pro Strategy Advisor — streams an AI strategy for a slate. Gated to Pro
 * subscribers (free users see a static teaser client-side and never call this).
 */
export async function POST(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!profile.proSubscriber) {
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const { slateId } = (await req.json().catch(() => ({}))) as {
    slateId?: string;
  };
  if (!slateId) {
    return NextResponse.json({ error: "Missing slateId" }, { status: 400 });
  }

  const slate = await fetchSlate(adminDb(), slateId);
  if (!slate) {
    return NextResponse.json({ error: "Slate not found" }, { status: 404 });
  }

  const context = await fetchUserChatContext(adminDb(), profile.id, {
    includeCategoryStats: true,
  });
  const system = buildAdvisorSystemPrompt(
    context,
    slate.title,
    slate.category,
    slate.predictions.map((p) => ({
      question: p.question,
      optionA: p.optionA,
      optionB: p.optionB,
      probA: p.probA,
      probB: p.probB,
    })),
  );

  const anthropicStream = getAnthropic().messages.stream({
    model: ADVISOR_MODEL,
    max_tokens: 600,
    system,
    messages: [
      { role: "user", content: "Give me your strategy for this slate." },
    ],
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
