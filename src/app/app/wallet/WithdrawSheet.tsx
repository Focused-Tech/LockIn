"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Input, Sheet } from "@/components/ui";
import { MIN_WITHDRAWAL_CENTS } from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { requestWithdrawal } from "./actions";

export function WithdrawSheet({
  open,
  onClose,
  availableCents,
  kycVerified,
}: {
  open: boolean;
  onClose: () => void;
  availableCents: number;
  kycVerified: boolean;
}) {
  const [dollars, setDollars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const amountCents = Math.round((parseFloat(dollars) || 0) * 100);
  const valid =
    amountCents >= MIN_WITHDRAWAL_CENTS && amountCents <= availableCents;

  function close() {
    setDollars("");
    setError(null);
    setDone(false);
    setPending(false);
    onClose();
  }

  async function onConfirm() {
    setError(null);
    setPending(true);
    const result = await requestWithdrawal({ amountCents });
    setPending(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  }

  return (
    <Sheet open={open} onClose={close} title="Withdraw">
      {!kycVerified ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            You must verify your identity before withdrawing winnings.
          </p>
          <Link
            href="/onboarding"
            className="rounded border border-accent-border bg-accent-soft px-4 py-3 text-center text-sm font-medium text-accent"
          >
            Verify identity
          </Link>
        </div>
      ) : done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">
            Withdrawal requested. ACH transfers take{" "}
            <span className="font-medium">1–3 business days</span>.
          </p>
          <Button variant="accent" size="lg" onClick={close}>
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded border border-border bg-surface p-3 text-sm">
            <span className="text-muted">Available</span>
            <span className="font-semibold text-foreground">
              {formatCents(availableCents)}
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Amount (USD)</span>
            <Input
              type="number"
              inputMode="decimal"
              min={MIN_WITHDRAWAL_CENTS / 100}
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
            />
            <span className="text-xs text-muted">
              Minimum {formatCents(MIN_WITHDRAWAL_CENTS)}
            </span>
          </label>

          <p className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted">
            Winnings of $600 or more per year are reported to the IRS
            (1099-MISC).
          </p>

          {error && (
            <p
              role="alert"
              className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
            >
              {error}
            </p>
          )}

          <Button
            variant="accent"
            size="lg"
            disabled={!valid || pending}
            onClick={onConfirm}
          >
            {pending ? "Requesting…" : `Withdraw ${formatCents(amountCents)}`}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
