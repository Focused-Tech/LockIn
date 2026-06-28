"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { refillPractice } from "./actions";
import { resolveAndGo } from "./joinActions";

/** Join-by-code + refill-when-busted controls on the practice home. */
export function PracticeHomeClient({
  busted,
  balance,
}: {
  busted: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const join = () =>
    startTransition(async () => {
      setError(null);
      const res = await resolveAndGo(code);
      if (res.ok) router.push(`/app/practice/${res.contestId}`);
      else setError(res.error);
    });

  const refill = () =>
    startTransition(async () => {
      await refillPractice();
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-3">
      {busted && (
        <div className="flex items-center justify-between rounded border border-loss-border bg-loss-soft px-3 py-2 text-sm">
          <span className="text-loss">Out of practice coins ({balance}).</span>
          <Button variant="accent" size="sm" disabled={pending} onClick={refill}>
            Free refill → 500
          </Button>
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
          variant="accent"
          disabled={pending || code.trim().length < 4}
          onClick={join}
        >
          Join
        </Button>
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
    </Card>
  );
}
