import { NextResponse, type NextRequest } from "next/server";
import { runAutoSettlement } from "@/server/settlement/cron";

export const runtime = "nodejs";
/** Allow headroom for batch settling several slates in one run. */
export const maxDuration = 60;

/**
 * Auto-settlement cron. Schedule it (Vercel Cron, GitHub Actions, cron-job.org…)
 * to GET this endpoint every few minutes.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron sends this header
 * automatically when CRON_SECRET is set in the project env.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runAutoSettlement();
  return NextResponse.json({ ok: true, ...report });
}
