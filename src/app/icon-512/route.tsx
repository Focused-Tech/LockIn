import { ImageResponse } from "next/og";
import { LOCK_ICON_DATA_URI } from "@/lib/pwa/iconData";

export const runtime = "nodejs";

/** PWA icon (any) — the new LockIn lock icon. */
export function GET() {
  return new ImageResponse(
    (
      <img
        src={LOCK_ICON_DATA_URI}
        width={512}
        height={512}
        style={{ width: 512, height: 512 }}
        alt=""
      />
    ),
    { width: 512, height: 512 },
  );
}
