import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { settleReadyParlays } from "@/server/settlement/crossParlay";

export const runtime = "nodejs";

/**
 * Settle all ready cross-slate parlays (every included slate is final). Guarded
 * by the ADMIN_SETTLE_SECRET bearer — intended for an admin tool or cron.
 *
 *   curl -X POST /api/admin/settle-parlays \
 *     -H "authorization: Bearer $ADMIN_SETTLE_SECRET"
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETTLE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await settleReadyParlays(adminDb());
  return NextResponse.json(result);
}
