"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initDeepLinks, initPush } from "@/lib/notifications/native";

/** Initializes native push + deep-link handling once (no-op on web). */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    void initPush();
    void initDeepLinks((path) => router.push(path));
  }, [router]);
  return null;
}
