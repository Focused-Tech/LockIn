"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * SCROLL BUG FIX (global). The app's scroll container is AppFrame's
 * `<main id="app-scroll" class="overflow-y-auto">`, NOT the window. Next.js App
 * Router only restores/reset WINDOW scroll on navigation — it never touches a
 * custom container — so `<main>.scrollTop` carried across routes, and a shorter
 * new page clamped that leftover offset to its maximum (i.e. the BOTTOM).
 *
 * This resets the container to the top on every route change, before paint, so
 * every page loads from position 0. One place, all routes.
 */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ScrollReset() {
  const pathname = usePathname();
  useIsoLayoutEffect(() => {
    document.getElementById("app-scroll")?.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
