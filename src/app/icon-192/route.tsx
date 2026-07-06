import { ImageResponse } from "next/og";
import { LOCK_ICON_DATA_URI } from "@/lib/pwa/iconData";

export const runtime = "nodejs";

/** PWA icon (any) — the new LockIn lock icon (black tile, orange padlock, fox-head keyhole). */
export function GET() {
  return new ImageResponse(
    (
      <img
        src={LOCK_ICON_DATA_URI}
        width={192}
        height={192}
        style={{ width: 192, height: 192 }}
        alt=""
      />
    ),
    { width: 192, height: 192 },
  );
}
