"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";

export function StrategyAdvisor({
  slateId,
  isPro,
}: {
  slateId: string;
  isPro: boolean;
}) {
  const [analysis, setAnalysis] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPro) {
    return (
      <Card className="flex flex-col gap-2 border-ai/30 bg-[rgba(59,139,255,0.06)]">
        <p className="text-sm font-semibold text-ai">AI Strategy Advisor</p>
        <p className="text-sm text-muted">
          Pro members get a full AI breakdown of this slate — a recommended
          card, your category edge, and a risk read.
        </p>
        <Link
          href="/app/pro"
          className="self-start rounded border border-ai/40 bg-[rgba(59,139,255,0.12)] px-3 py-1.5 text-sm font-medium text-ai"
        >
          Unlock with Pro
        </Link>
      </Card>
    );
  }

  async function run() {
    setError(null);
    setPending(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slateId }),
      });
      if (!res.ok || !res.body) throw new Error("request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnalysis(acc);
      }
    } catch {
      setError("Couldn't generate a strategy right now. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-ai/30">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ai">AI Strategy Advisor</p>
        <Button variant="neutral" size="sm" disabled={pending} onClick={run}>
          {pending ? "Thinking…" : analysis ? "Regenerate" : "Get strategy"}
        </Button>
      </div>
      {analysis && (
        <p className="whitespace-pre-wrap text-sm text-foreground">{analysis}</p>
      )}
      {error && <p className="text-sm text-loss">{error}</p>}
    </Card>
  );
}
