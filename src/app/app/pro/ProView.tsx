"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { PRO_PRICE_CENTS } from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { createBillingPortal, createProCheckout } from "./actions";

const BENEFITS = [
  "AI Strategy Advisor — full parlay analysis on every slate",
  "Your category performance + historical accuracy",
];

export function ProView({
  isPro,
  expiresMs,
  justSubscribed,
}: {
  isPro: boolean;
  expiresMs: number;
  justSubscribed: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(action: typeof createProCheckout | typeof createBillingPortal) {
    setError(null);
    setPending(true);
    const result = await action();
    if (result.ok) window.location.href = result.url;
    else {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {justSubscribed && (
        <div className="rounded border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.10)] px-4 py-3 text-sm text-win">
          Welcome to Pro! Your strategy advisor is unlocked.
        </div>
      )}

      <Card className="flex flex-col gap-3 border-ai/40">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ai">LockIn Pro</span>
          <span className="text-sm text-muted">
            {formatCents(PRO_PRICE_CENTS)}/mo
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <span className="text-ai">✓</span>
              <span className="text-foreground">{b}</span>
            </li>
          ))}
        </ul>
      </Card>

      {isPro ? (
        <Card className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold text-win">Pro is active.</span>{" "}
            {expiresMs > 0 && (
              <span className="text-muted">
                Renews {new Date(expiresMs).toLocaleDateString()}.
              </span>
            )}
          </p>
          <Button
            variant="neutral"
            size="lg"
            disabled={pending}
            onClick={() => go(createBillingPortal)}
          >
            {pending ? "Opening…" : "Manage subscription"}
          </Button>
        </Card>
      ) : (
        <Button
          variant="accent"
          size="lg"
          disabled={pending}
          onClick={() => go(createProCheckout)}
        >
          {pending ? "Starting…" : `Go Pro · ${formatCents(PRO_PRICE_CENTS)}/mo`}
        </Button>
      )}

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      <p className="text-xs text-muted">
        Billed monthly via Stripe. Cancel anytime from Manage subscription.
      </p>
    </div>
  );
}
