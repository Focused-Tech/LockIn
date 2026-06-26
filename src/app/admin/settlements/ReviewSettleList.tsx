"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/components/ui";
import type { ReviewSlate } from "@/server/data/review";
import { resolveSlate } from "./actions";

export function ReviewSettleList({ slates }: { slates: ReviewSlate[] }) {
  if (slates.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        Nothing awaiting review.
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {slates.map((s) => (
        <ReviewSlateCard key={s.id} slate={s} />
      ))}
    </ul>
  );
}

function ReviewSlateCard({ slate }: { slate: ReviewSlate }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, "a" | "b">>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allPicked = slate.predictions.every((p) => picks[p.id]);

  async function submit() {
    setError(null);
    setPending(true);
    const res = await resolveSlate(slate.id, picks);
    if (res.ok) router.refresh();
    else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{slate.title}</p>
          <Pill tone="neutral">{slate.entryCount} entries</Pill>
        </div>

        <div className="flex flex-col gap-3">
          {slate.predictions.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm font-medium">{p.question}</p>
              {p.evidence.length > 0 && (
                <ul className="flex flex-col gap-0.5">
                  {p.evidence.map((e, i) => (
                    <li key={i} className="text-xs text-muted">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {p.confidence !== null && (
                <p className="text-xs text-muted">
                  Verifier confidence: {p.confidence}%
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(["a", "b"] as const).map((side) => {
                  const on = picks[p.id] === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() =>
                        setPicks((x) => ({ ...x, [p.id]: side }))
                      }
                      className={
                        "rounded border px-3 py-2 text-left text-sm transition-colors " +
                        (on
                          ? "border-accent-border bg-accent-soft text-accent"
                          : "border-border text-muted hover:text-foreground")
                      }
                    >
                      {side === "a" ? p.optionA : p.optionB}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-loss">{error}</p>}

        <Button
          variant="accent"
          size="lg"
          disabled={!allPicked || pending}
          onClick={submit}
        >
          {pending
            ? "Settling…"
            : allPicked
              ? "Resolve & settle"
              : "Pick every outcome to settle"}
        </Button>
      </Card>
    </li>
  );
}
