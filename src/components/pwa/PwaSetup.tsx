"use client";

import { useEffect, useState } from "react";
import { isNativePlatform } from "@/lib/platform";
import { LockGlyph } from "@/components/practice/LockGlyph";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lockin:pwa-dismissed";

/**
 * Registers the service worker and shows an install banner when the browser
 * fires `beforeinstallprompt` (Chromium/Android). iOS install is handled by the
 * Apple meta tags + "Add to Home Screen".
 */
export function PwaSetup() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Do NOT register the service worker inside the Capacitor native WebView.
    // The SW intercepting navigations caused post-deploy ERR_FAILED reload loops
    // in the APK; the native shell doesn't need offline caching. Web only.
    if (!isNativePlatform() && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setPromptEvent(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setPromptEvent(null);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-surface-card p-3 shadow-2xl">
        <LockGlyph size={26} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install LockIn</p>
          <p className="text-xs text-muted">
            Add it to your home screen for a full-screen, app-like experience.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-muted hover:text-foreground"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          className="rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
        >
          Install
        </button>
      </div>
    </div>
  );
}
