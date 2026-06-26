"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import type { EntryPick } from "@/lib/firebase/types";
import type { FeedSlate } from "@/lib/feed";
import { createPackage } from "@/app/app/packages/actions";

export function PackageBuilder({ slate }: { slate: FeedSlate }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(`${slate.title} — my picks`);
  const [price, setPrice] = useState("4.99");
  const [coinsEnabled, setCoinsEnabled] = useState(true);
  const [coinPrice, setCoinPrice] = useState("2000");
  const [ebEnabled, setEbEnabled] = useState(false);
  const [ebPrice, setEbPrice] = useState("2.99");
  const [ebUntil, setEbUntil] = useState("");
  const [picks, setPicks] = useState<Record<string, "a" | "b">>({});

  const allPicked = slate.predictions.every((p) => picks[p.id]);

  function onSubmit() {
    setError(null);
    if (!allPicked) {
      setError("Pick a side on every question");
      return;
    }
    const picksArr: EntryPick[] = slate.predictions.map((p) => ({
      predictionId: p.id,
      choice: picks[p.id]!,
    }));

    startTransition(async () => {
      const result = await createPackage({
        slateId: slate.id,
        name: name.trim(),
        priceCents: Math.round((parseFloat(price) || 0) * 100),
        coinPrice: coinsEnabled ? parseInt(coinPrice, 10) || 0 : null,
        earlyBirdPriceCents: ebEnabled
          ? Math.round((parseFloat(ebPrice) || 0) * 100)
          : null,
        earlyBirdUntilMs: ebEnabled && ebUntil ? new Date(ebUntil).getTime() : null,
        picks: picksArr,
      });
      if (result.ok) router.push("/app/packages");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Package name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Price (USD)</span>
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="accent-accent"
              checked={coinsEnabled}
              onChange={(e) => setCoinsEnabled(e.target.checked)}
            />
            Also sell for coins
          </label>
          <Input
            type="number"
            inputMode="numeric"
            className="h-9 w-28"
            value={coinPrice}
            disabled={!coinsEnabled}
            onChange={(e) => setCoinPrice(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="accent-accent"
            checked={ebEnabled}
            onChange={(e) => setEbEnabled(e.target.checked)}
          />
          Early-bird discount
        </label>
        {ebEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Early price (USD)</span>
              <Input
                type="number"
                inputMode="decimal"
                value={ebPrice}
                onChange={(e) => setEbPrice(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Until</span>
              <Input
                type="datetime-local"
                value={ebUntil}
                onChange={(e) => setEbUntil(e.target.value)}
              />
            </label>
          </div>
        )}
      </Card>

      {/* Your picks */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Your picks</h2>
        {slate.predictions.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{p.question}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((side) => {
                const label = side === "a" ? p.optionA : p.optionB;
                const selected = picks[p.id] === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setPicks((x) => ({ ...x, [p.id]: side }))}
                    className={
                      "rounded border px-3 py-2.5 text-left text-sm transition-colors " +
                      (selected
                        ? "border-accent-border bg-accent-soft text-accent"
                        : "border-border bg-surface hover:bg-[#161b25]")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-3 py-2 text-sm text-loss"
        >
          {error}
        </p>
      )}

      <Button variant="accent" size="lg" disabled={pending} onClick={onSubmit}>
        {pending ? "Publishing…" : "Publish package"}
      </Button>
    </div>
  );
}
