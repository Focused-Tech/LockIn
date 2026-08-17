import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { buildDataExport, exportFilename } from "@/server/account/export";

/** firebase-admin needs the Node.js runtime. */
export const runtime = "nodejs";
/** Never cache one account's data export. */
export const dynamic = "force-dynamic";

/**
 * GET /api/account/export — download everything we hold about the signed-in account as JSON.
 *
 * The uid comes from the verified session cookie, never from a query parameter, so there is no
 * shape of request that exports somebody else's data.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const data = await buildDataExport(adminDb(), user.uid, nowIso);
  const filename = exportFilename(data.account.username, nowIso);

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
