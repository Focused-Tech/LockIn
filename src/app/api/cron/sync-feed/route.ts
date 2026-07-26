import { NextResponse, type NextRequest } from "next/server";
import { syncFeed } from "@/server/feeds/sync";

export const runtime = "nodejs";
/** ESPN + optional Odds API across several leagues — give it headroom. */
export const maxDuration = 60;

/**
 * Real data-feed sync cron. Schedule it (Vercel Cron) to GET this endpoint a couple times a day.
 * Pulls upcoming games from ESPN (+ The Odds API if THE_ODDS_API_KEY is set) and upserts them as
 * live prediction slates.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this automatically).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await syncFeed();
  return NextResponse.json({ ok: true, ...report });
}
