import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";

export const runtime = "nodejs";

/**
 * Server-side UNPUBLISH of a reported slate (Part 3f). Sets `moderationHidden` on the slate doc; the
 * display path (applyWithhold in server/data/slates.ts) then withholds it from every render — feed,
 * single-slate, embed — and strips its predictions, WITHOUT cancelling/refunding it. Reversible by
 * passing `restore:true`. Guarded by the admin bearer (same as /api/admin/settle) until an admin UI exists.
 *
 *   curl -X POST /api/admin/unpublish \
 *     -H "authorization: Bearer $ADMIN_SETTLE_SECRET" \
 *     -d '{"slateId":"<id>"}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETTLE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slateId, restore } = (await req.json().catch(() => ({}))) as {
    slateId?: string;
    restore?: boolean;
  };
  if (!slateId) return NextResponse.json({ error: "Missing slateId" }, { status: 400 });

  const ref = adminDb().collection(COLLECTIONS.slates).doc(slateId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "No such slate" }, { status: 404 });

  await ref.update({ moderationHidden: restore !== true });
  return NextResponse.json({ ok: true, slateId, moderationHidden: restore !== true });
}
