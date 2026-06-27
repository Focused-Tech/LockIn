"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  completeSocialRedirect,
  signInWithProvider,
  type SocialProvider,
} from "@/lib/firebase/auth";

/**
 * "Continue with Google / Apple" buttons, shared by /login and /signup.
 *
 * Web uses a popup and routes inline; native (Capacitor WebView) uses a
 * full-page redirect, which this component completes on mount when the app
 * reloads back here. New accounts land in onboarding; returning accounts go
 * straight to /app (which then routes by lane).
 */
export function SocialAuthButtons({ referralCode }: { referralCode?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<SocialProvider | "redirect" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const routeFor = (isNewUser: boolean) =>
    router.push(isNewUser ? "/onboarding" : "/app");

  // Complete a redirect-based sign-in if we just came back from one.
  useEffect(() => {
    let active = true;
    setPending("redirect");
    completeSocialRedirect()
      .then((result) => {
        if (!active) return;
        if (result) routeFor(result.isNewUser);
        else setPending(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Sign-in failed");
        setPending(null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(kind: SocialProvider) {
    setError(null);
    setPending(kind);
    try {
      const result = await signInWithProvider(kind, referralCode);
      if (result.completed) routeFor(result.isNewUser ?? false);
      // Otherwise a native redirect is in flight; the page will reload and the
      // mount effect above finishes it.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="neutral"
        size="lg"
        className="w-full"
        disabled={pending !== null}
        onClick={() => start("google")}
      >
        <GoogleGlyph />
        {pending === "google" ? "Connecting…" : "Continue with Google"}
      </Button>

      <Button
        variant="neutral"
        size="lg"
        className="w-full"
        disabled={pending !== null}
        onClick={() => start("apple")}
      >
        <AppleGlyph />
        {pending === "apple" ? "Connecting…" : "Continue with Apple"}
      </Button>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" className="mr-2" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 384 512"
      className="mr-2 fill-current"
      aria-hidden
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
