"use client";

import { useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button, Input, Sheet } from "@/components/ui";
import { getStripe } from "@/lib/stripe/client";
import { depositFeeCents, depositTotalCents } from "@/lib/stripe/fees";
import {
  DEPOSIT_MAX_CENTS,
  DEPOSIT_MIN_CENTS,
  DEPOSIT_PRESETS_CENTS,
  type PaymentMethodKind,
} from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { createDepositIntent } from "./actions";

export function DepositSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const stripePromise = useMemo(() => getStripe(), []);

  const [dollars, setDollars] = useState("25");
  const [method, setMethod] = useState<PaymentMethodKind>("card");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const netCents = Math.round((parseFloat(dollars) || 0) * 100);
  const valid = netCents >= DEPOSIT_MIN_CENTS && netCents <= DEPOSIT_MAX_CENTS;
  const feeCents = valid ? depositFeeCents(netCents, method) : 0;
  const totalCents = valid ? depositTotalCents(netCents, method) : 0;

  function reset() {
    setClientSecret(null);
    setError(null);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function onContinue() {
    setError(null);
    setPending(true);
    const result = await createDepositIntent({ amountCents: netCents, method });
    setPending(false);
    if (result.ok) setClientSecret(result.clientSecret);
    else setError(result.error);
  }

  return (
    <Sheet open={open} onClose={close} title="Add funds">
      {clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: { colorPrimary: "#FF3B00" },
            },
          }}
        >
          <PaymentStep totalCents={totalCents} onBack={reset} />
        </Elements>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            {DEPOSIT_PRESETS_CENTS.map((preset) => {
              const active = netCents === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDollars(String(preset / 100))}
                  className={
                    "rounded border py-2 text-sm transition-colors " +
                    (active
                      ? "border-accent-border bg-accent-soft text-accent"
                      : "border-border text-foreground hover:bg-[#161b25]")
                  }
                >
                  {formatCents(preset)}
                </button>
              );
            })}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Amount (USD)</span>
            <Input
              type="number"
              inputMode="decimal"
              min={DEPOSIT_MIN_CENTS / 100}
              max={DEPOSIT_MAX_CENTS / 100}
              value={dollars}
              onChange={(e) => setDollars(e.target.value)}
            />
            <span className="text-xs text-muted">
              Min {formatCents(DEPOSIT_MIN_CENTS)} · Max{" "}
              {formatCents(DEPOSIT_MAX_CENTS)}
            </span>
          </label>

          {/* Payment method toggle */}
          <div className="grid grid-cols-2 gap-2">
            <MethodButton
              active={method === "card"}
              onClick={() => setMethod("card")}
              title="Card"
              subtitle={
                valid ? `${formatCents(feeCents)} fee` : "2.9% + $0.30 fee"
              }
            />
            <MethodButton
              active={method === "ach"}
              onClick={() => setMethod("ach")}
              title="Bank transfer"
              subtitle="Free"
              freeLabel
            />
          </div>

          {/* Fee breakdown — shown BEFORE confirming */}
          <div className="rounded border border-border bg-surface p-3 text-sm">
            <Row label="Deposit" value={formatCents(valid ? netCents : 0)} />
            <Row
              label="Processing fee"
              value={
                method === "ach" ? (
                  <span className="font-semibold text-win">Free</span>
                ) : (
                  formatCents(feeCents)
                )
              }
            />
            <div className="my-2 border-t border-border" />
            <Row
              label={<span className="font-medium text-foreground">Total charged</span>}
              value={
                <span className="font-semibold text-foreground">
                  {formatCents(totalCents)}
                </span>
              }
            />
          </div>

          <p className="rounded border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.10)] px-3 py-2 text-xs text-win">
            Save on fees! Larger deposits = lower fee %. Bank transfers are
            fee-free.
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
            onClick={onContinue}
          >
            {pending
              ? "Starting…"
              : `Continue · ${formatCents(totalCents)}`}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function MethodButton({
  active,
  onClick,
  title,
  subtitle,
  freeLabel,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  freeLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col items-start rounded border px-3 py-2 text-left transition-colors " +
        (active
          ? "border-accent-border bg-accent-soft"
          : "border-border hover:bg-[#161b25]")
      }
    >
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className={freeLabel ? "text-xs font-semibold text-win" : "text-xs text-muted"}>
        {subtitle}
      </span>
    </button>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Stripe Payment Element step — confirms the PaymentIntent. */
function PaymentStep({
  totalCents,
  onBack,
}: {
  totalCents: number;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;
    setPending(true);
    setError(null);
    const { error: payErr } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app/wallet?deposit=submitted`,
      },
    });
    // Reached only if confirmation did not redirect (i.e. an error occurred).
    setError(payErr?.message ?? "Payment could not be completed");
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}
      <Button variant="accent" size="lg" disabled={!stripe || pending} onClick={onPay}>
        {pending ? "Processing…" : `Pay ${formatCents(totalCents)}`}
      </Button>
      <Button variant="ghost" onClick={onBack} disabled={pending}>
        Back
      </Button>
    </div>
  );
}
