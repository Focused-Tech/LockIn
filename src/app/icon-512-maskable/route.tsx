import { ImageResponse } from "next/og";
import { LOCK_ICON_DATA_URI } from "@/lib/pwa/iconData";

export const runtime = "nodejs";

/**
 * Maskable PWA icon — the new lock icon is a full-square tile (corners filled),
 * designed for the OS to mask, so it renders full-bleed at 512.
 */
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
