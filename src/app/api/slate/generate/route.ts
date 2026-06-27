import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/firebase/session";
import { generateSlate } from "@/lib/ai/aiEngine";

/** Anthropic SDK needs the Node.js runtime. */
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  topic: z.string().min(2).max(200),
  legCount: z.number().int().min(1).max(10),
  /** Optional external odds feed keyed by 0-based leg index; unset = LLM-only. */
  oddsFeed: z.record(z.string(), z.object({ probA: z.number() })).optional(),
});

/**
 * Server-side AI slate generator. Auth-gated (any signed-in user — the creator
 * builder calls it). Returns a ranked, difficulty-graded slate as JSON.
 *
 * Errors map cleanly so the build is never blocked by a missing key:
 *   - AI_NOT_CONFIGURED  -> 503 (ANTHROPIC_API_KEY not set in this env)
 *   - AI_NO_TOOL_OUTPUT  -> 502 (model returned no structured slate)
 *   - validation         -> 400
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Normalize the string-keyed odds feed to a number-indexed map.
  const oddsFeed = parsed.data.oddsFeed
    ? Object.fromEntries(
        Object.entries(parsed.data.oddsFeed).map(([k, v]) => [Number(k), v]),
      )
    : undefined;

  try {
    const slate = await generateSlate({
      topic: parsed.data.topic,
      legCount: parsed.data.legCount,
      oddsFeed,
    });
    return NextResponse.json(slate, { status: 200 });
  } catch (err) {
    const code = err instanceof Error ? err.message : "AI_ERROR";
    if (code === "AI_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "AI is not configured (ANTHROPIC_API_KEY missing)" },
        { status: 503 },
      );
    }
    if (code === "AI_NO_TOOL_OUTPUT") {
      return NextResponse.json(
        { error: "The model did not return a slate. Try again." },
        { status: 502 },
      );
    }
    console.error("[slate/generate] failed:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
