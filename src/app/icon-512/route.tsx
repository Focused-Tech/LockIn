import { ImageResponse } from "next/og";
import { PadlockMark } from "@/lib/pwa/padlock";

export const runtime = "nodejs";

export function GET() {
  return new ImageResponse(<PadlockMark size={512} />, {
    width: 512,
    height: 512,
  });
}
