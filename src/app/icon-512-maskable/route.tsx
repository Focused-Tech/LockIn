import { ImageResponse } from "next/og";
import { PadlockMark } from "@/lib/pwa/padlock";

export const runtime = "nodejs";

// Maskable: ~12% safe-area padding so launchers can crop to any shape.
export function GET() {
  return new ImageResponse(<PadlockMark size={512} padding={64} />, {
    width: 512,
    height: 512,
  });
}
