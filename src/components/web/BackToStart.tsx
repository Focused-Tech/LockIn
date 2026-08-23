import Link from "next/link";
import { isWeb } from "@/lib/surface";

/**
 * "A role is never a cage" — every lane on /start routes into a real destination, and every one of
 * those destinations needs a way back to the front door.
 *
 * Those destinations are app routes rendered inside the phone shell, and this task must not change
 * any mobile app screen. So this component RETURNS NULL on the mobile surface: the binary renders
 * nothing extra, byte for byte, and only the web deployment gets the back link.
 *
 * Rendered by the app and admin layouts, which is the smallest number of places that covers every
 * lane destination (/app, /app/creator, /app/beginner, /app/keyholder, /app/keymaster, /admin).
 */
export function BackToStart() {
  if (!isWeb()) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        top: 16,
        zIndex: 60,
      }}
    >
      <Link
        href="/start"
        style={{
          display: "inline-block",
          padding: "7px 13px",
          borderRadius: 10,
          border: "1px solid #1E2A38",
          background: "rgba(13,17,24,.92)",
          color: "#8b97a8",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        ← Lock In
      </Link>
    </div>
  );
}
