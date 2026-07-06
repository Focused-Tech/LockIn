"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { refreshConnectStatus, startConnectOnboarding } from "./actions";

export function ConnectPayoutCard({
  connected,
  payoutsEnabled,
  justReturned,
}: {
  connected: boolean;
  payoutsEnabled: boolean;
  justReturned: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = useRef(false);

  // After returning from Stripe onboarding, pull the latest payout status once.
  useEffect(() => {
    if (justReturned && !payoutsEnabled && !synced.current) {
      synced.current = true;
      refreshConnectStatus().then((r) => {
        if (r.enabled) router.refresh();
      });
    }
  }, [justReturned, payoutsEnabled, router]);

  async function start() {
    setError(null);
    setPending(true);
    const res = await startConnectOnboarding();
    if (res.ok) window.location.href = res.url;
    else {
      setError(res.error);
      setPending(false);
    }
  }

  if (payoutsEnabled) {
    return (
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-win">Payouts enabled</p>
          <p className="text-xs text-muted">
            Withdrawals go straight to your connected account.
          </p>
        </div>
        <span className="text-win">✓</span>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2 border-[rgba(59,139,255,0.35)] bg-[rgba(59,139,255,0.10)]">
      <p className="text-sm font-semibold text-ai">Set up payouts</p>
      <p className="text-sm text-muted">
        Connect a Stripe account to receive your creator earnings. Takes a couple
        of minutes.
      </p>
      {error && <p className="text-sm text-loss">{error}</p>}
      <Button
        variant="ai"
        size="lg"
        disabled={pending}
        onClick={start}
      >
        {pending
          ? "Opening…"
          : connected
            ? "Finish payout setup"
            : "Connect payouts"}
      </Button>
    </Card>
  );
}
