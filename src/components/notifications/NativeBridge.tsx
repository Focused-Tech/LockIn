"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initDeepLinks, initPush, initBackButton } from "@/lib/notifications/native";

/** Initializes native push + deep-link + hardware-back handling once (no-op on web). */
export function NativeBridge() {
  const router = useRouter();
  useEffect(() => {
    void initPush();
    void initDeepLinks((path) => router.push(path));
    void initBackButton();
  }, [router]);
  return null;
}
