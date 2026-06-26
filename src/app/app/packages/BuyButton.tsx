"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import { buyPackage } from "./actions";

export function BuyButton({
  packageId,
  priceCents,
  coinPrice,
}: {
  packageId: string;
  priceCents: number;
  coinPrice: number | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"cash" | "coins" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(method: "cash" | "coins") {
    setPending(method);
    setError(null);
    const result = await buyPackage({ packageId, method });
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {coinPrice !== null && (
          <Button
            variant="neutral"
            size="sm"
            disabled={pending !== null}
            onClick={() => buy("coins")}
          >
            {pending === "coins" ? "…" : `${coinPrice} coins`}
          </Button>
        )}
        <Button
          variant="accent"
          size="sm"
          disabled={pending !== null}
          onClick={() => buy("cash")}
        >
          {pending === "cash" ? "…" : formatCents(priceCents)}
        </Button>
      </div>
      {error && <span className="text-xs text-loss">{error}</span>}
    </div>
  );
}
