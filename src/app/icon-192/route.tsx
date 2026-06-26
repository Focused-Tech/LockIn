import { ImageResponse } from "next/og";
import { PadlockMark } from "@/lib/pwa/padlock";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(<PadlockMark size={192} />, {
    width: 192,
    height: 192,
  });
}
