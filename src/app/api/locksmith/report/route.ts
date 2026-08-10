import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { COLLECTIONS } from "@/lib/firebase/types";

/** firebase-admin needs the Node.js runtime. */
export const runtime = "nodejs";

type CtxMsg = { role: "user" | "assistant"; content: string };

/**
 * Player-filed report of a Locksmith message (Part 2c). Writes an append-only record to the
 * server-only moderation ledger and confirms receipt. Auth-gated; no money moves.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: unknown;
    context?: unknown;
    reason?: unknown;
  };

  const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "";
  if (!message.trim()) return NextResponse.json({ error: "No message" }, { status: 400 });

  const context: CtxMsg[] = Array.isArray(body.context)
    ? body.context
        .filter(
          (m): m is CtxMsg =>
            !!m &&
            typeof m === "object" &&
            ((m as CtxMsg).role === "user" || (m as CtxMsg).role === "assistant") &&
            typeof (m as CtxMsg).content === "string",
        )
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
    : [];

  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.slice(0, 500) : null;

  await adminDb()
    .collection(COLLECTIONS.locksmithReports)
    .add({
      kind: "user_report",
      direction: "output",
      category: null,
      message,
      context,
      reason,
      userId: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

  return NextResponse.json({ ok: true });
}
