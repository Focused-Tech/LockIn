"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import {
  DEPOSIT_LIMITS,
  NCPG_HOTLINE,
  SELF_EXCLUSION_PERIODS,
  type SelfExclusionKey,
} from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { setSelfExclusion, updateDepositLimits } from "./actions";

interface Limits {
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}

export function ResponsiblePlayView({
  limits,
  usage,
  exclusionUntilMs,
  permanent,
}: {
  limits: Limits;
  usage: Limits;
  exclusionUntilMs: number;
  permanent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [daily, setDaily] = useState(String(limits.dailyCents / 100));
  const [weekly, setWeekly] = useState(String(limits.weeklyCents / 100));
  const [monthly, setMonthly] = useState(String(limits.monthlyCents / 100));

  const excluded = exclusionUntilMs > 0;

  function saveLimits() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDepositLimits({
        dailyCents: Math.round((parseFloat(daily) || 0) * 100),
        weeklyCents: Math.round((parseFloat(weekly) || 0) * 100),
        monthlyCents: Math.round((parseFloat(monthly) || 0) * 100),
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else setError(result.error);
    });
  }

  function exclude(key: SelfExclusionKey, label: string) {
    const msg =
      key === "permanent"
        ? "Permanently self-exclude? This CANNOT be undone."
        : `Self-exclude for ${label}? This can't be shortened once set.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const result = await setSelfExclusion(key);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {excluded && (
        <Card className="border-accent-border bg-accent-soft">
          <p className="text-sm font-medium text-accent">
            Your account is self-excluded
          </p>
          <p className="mt-1 text-xs text-muted">
            {permanent
              ? "This exclusion is permanent."
              : `Play and deposits are paused until ${new Date(
                  exclusionUntilMs,
                ).toLocaleString()}.`}
          </p>
        </Card>
      )}

      {/* Deposit limits */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Deposit limits</h2>
        <LimitRow
          label="Daily"
          value={daily}
          onChange={setDaily}
          cap={DEPOSIT_LIMITS.dailyCents}
          used={usage.dailyCents}
        />
        <LimitRow
          label="Weekly"
          value={weekly}
          onChange={setWeekly}
          cap={DEPOSIT_LIMITS.weeklyCents}
          used={usage.weeklyCents}
        />
        <LimitRow
          label="Monthly"
          value={monthly}
          onChange={setMonthly}
          cap={DEPOSIT_LIMITS.monthlyCents}
          used={usage.monthlyCents}
        />
        <Button
          variant="accent"
          size="md"
          disabled={pending}
          onClick={saveLimits}
        >
          {pending ? "Saving…" : "Save limits"}
        </Button>
        {saved && <p className="text-xs text-win">Limits updated.</p>}
      </Card>

      {/* Self-exclusion */}
      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Take a break</h2>
        <p className="text-xs text-muted">
          Self-exclusion pauses deposits, contest entries, and purchases. It
          can&apos;t be lifted early.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SELF_EXCLUSION_PERIODS.map((p) => (
            <Button
              key={p.key}
              variant="neutral"
              size="md"
              disabled={pending}
              onClick={() => exclude(p.key, p.label)}
              className={p.key === "permanent" ? "text-loss" : ""}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      {/* Help */}
      <Card className="text-xs leading-relaxed text-muted">
        If gambling stops being fun, help is available. Call the National Problem
        Gambling Helpline:{" "}
        <span className="font-semibold text-foreground">{NCPG_HOTLINE}</span> —
        free, confidential, 24/7.
      </Card>
    </div>
  );
}

function LimitRow({
  label,
  value,
  onChange,
  cap,
  used,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cap: number;
  used: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">
          Used {formatCents(used)} · max {formatCents(cap)}
        </p>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted">
        $
        <Input
          type="number"
          inputMode="decimal"
          className="h-9 w-24"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
