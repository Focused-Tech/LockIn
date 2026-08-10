import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { COLLECTIONS, type SlateDoc, type PickPackageDoc } from "@/lib/firebase/types";

/** firebase-admin needs the Node.js runtime. */
export const runtime = "nodejs";

/**
 * A player flags published creator content (a slate or package) as abusive (Part 3e). Writes an
 * append-only record to the server-only contentReports ledger; a moderator/unpublish flow acts on it.
 * Auth-gated; no money moves. The creator id is resolved server-side for reviewer context.
 */
export async function POST(req: NextRequest) {
  const reporterId = await getCurrentUserId();
  if (!reporterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
  };
  const targetType = body.targetType === "package" ? "package" : "slate";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  if (!targetId) return NextResponse.json({ error: "Missing target" }, { status: 400 });

  const db = adminDb();
  // Resolve the creator for reviewer context (best-effort).
  let creatorId: string | null = null;
  try {
    if (targetType === "slate") {
      const s = await db.collection(COLLECTIONS.slates).doc(targetId).get();
      creatorId = (s.data() as SlateDoc | undefined)?.creatorId ?? null;
    } else {
      const p = await db.collection(COLLECTIONS.pickPackages).doc(targetId).get();
      creatorId = (p.data() as PickPackageDoc | undefined)?.creatorId ?? null;
    }
  } catch {
    /* context lookup is best-effort */
  }

  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.slice(0, 500) : null;

  await db.collection(COLLECTIONS.contentReports).add({
    targetType,
    targetId,
    creatorId,
    reason,
    reporterId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
