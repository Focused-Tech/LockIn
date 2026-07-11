"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { startKycSession } from "@/app/app/kyc/actions";

type Phase = "idle" | "starting" | "launched" | "error";

/**
 * Launches identity verification from the point a paid entry is blocked for KYC.
 * Distinct, never-silent states: not started / starting / pending(launched) /
 * error(retry). Only the publishable key (NEXT_PUBLIC_*) is ever touched here —
 * no secret keys client-side.
 */
export function VerifyIdentityButton({
  kycStatus,
  className,
}: {
  kycStatus?: "unverified" | "pending" | "verified" | "rejected";
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    setError(null);
    setPhase("starting");
    try {
      const res = await startKycSession();
      if (!res.ok) {
        setError(res.error);
        setPhase("error");
        return;
      }

      if (res.provider === "stripe") {
        // Launch Stripe Identity's modal with the publishable key only.
        const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!pk) throw new Error("Verification isn't configured yet.");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(pk);
        if (!stripe) throw new Error("Couldn't load the verification module.");
        const result = await stripe.verifyIdentity(res.clientSecret);
        if (result.error) {
          throw new Error(
            result.error.message ?? "Verification was cancelled.",
          );
        }
        // Provider result arrives via webhook; status flips when it lands.
        setPhase("launched");
      } else {
        // Mock/dev provider — no real modal. Surface the session plainly.
        setPhase("launched");
      }
    } catch (err) {
      // NO silent failure.
      console.error("[VerifyIdentityButton] verification launch failed", err);
      setError(
        err instanceof Error ? err.message : "Couldn't start verification.",
      );
      setPhase("error");
    }
  }

  if (kycStatus === "verified") return null;

  const label =
    phase === "starting"
      ? "Starting…"
      : kycStatus === "rejected"
        ? "Try verifying again"
        : "Verify your identity";

  return (
    <div className={className}>
      {phase === "launched" ? (
        <p className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
          Verification in progress. We&apos;ll unlock real-money play as soon as
          your identity is confirmed. You can play the practice version now.
        </p>
      ) : (
        <Button
          type="button"
          variant="accent"
          size="sm"
          className="w-full"
          disabled={phase === "starting"}
          onClick={onVerify}
        >
          {label}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}
