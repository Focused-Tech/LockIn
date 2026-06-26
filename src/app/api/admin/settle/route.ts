import { NextResponse, type NextRequest } from "next/server";
import { settleSlate } from "@/server/settlement/settle";

export const runtime = "nodejs";

/**
 * Trigger settlement for a slate. Guarded by a bearer secret
 * (ADMIN_SETTLE_SECRET) — intended for an admin tool or a cron job until a
 * proper admin UI / scheduled auto-settlement exists.
 *
 *   curl -X POST /api/admin/settle \
 *     -H "authorization: Bearer $ADMIN_SETTLE_SECRET" \
 *     -d '{"slateId":"seed-daytona-500"}'
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETTLE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slateId } = (await req.json().catch(() => ({}))) as {
    slateId?: string;
  };
  if (!slateId) {
    return NextResponse.json({ error: "Missing slateId" }, { status: 400 });
  }

  const result = await settleSlate(slateId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
