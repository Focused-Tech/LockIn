"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { refillPractice } from "./actions";
import { resolveAndGo } from "./joinActions";

function countdown(ms: number): string {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Join-by-code + the DAILY refill state (countdown when busted, never blocks browsing). */
export function PracticeHomeClient({
  busted,
  balance,
  refillAt,
}: {
  busted: boolean;
  balance: number;
  refillAt: number | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  // Live-ish countdown while busted.
  useEffect(() => {
    if (!busted) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [busted]);

  const canClaim = busted && (refillAt == null || now >= refillAt);
  const remaining = refillAt ? refillAt - now : 0;

  const join = () =>
    startTransition(async () => {
      setError(null);
      const r = await resolveAndGo(code);
      if (r.ok) router.push(`/app/practice/${r.contestId}`);
      else setError(r.error);
    });

  const claim = () =>
    startTransition(async () => {
      await refillPractice();
      router.refresh();
    });

  return (
    <div className="arena-panel flex flex-col gap-3">
      {busted && (
        <div className="rounded border border-loss-border bg-loss-soft px-3 py-2.5 text-sm">
          {canClaim ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-loss">
                Your daily refill is ready 🎁
              </span>
              <Button
                variant="win"
                size="sm"
                disabled={pending}
                onClick={claim}
              >
                Claim 500 coins
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-loss">
                Out of coins ({balance}) — refills tomorrow
              </span>
              <span className="text-xs text-muted">
                Free top-up to 500 in <b>{countdown(remaining)}</b>. You can still
                browse &amp; host — you just can&apos;t stake until then. Coins are
                never buyable with real money.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-muted">Join with a friend&apos;s code</span>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
          />
        </label>
        <Button
          variant="neutral"
          disabled={pending || code.trim().length < 4}
          onClick={join}
        >
          Join
        </Button>
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
