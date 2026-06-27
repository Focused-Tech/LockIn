"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

const SIZES = [
  { key: "story", label: "Story", dims: "1080×1920" },
  { key: "square", label: "Feed", dims: "1080×1080" },
  { key: "landscape", label: "Wide", dims: "1200×630" },
] as const;

/**
 * Creator-facing branded share-card panel. Behind an explicit image-use consent
 * gate (the card includes the creator's handle), it reveals the three server-
 * rendered PNG sizes and the deep link (lockin://slate/<id>) baked into the card.
 */
export function ShareCardPanel({ slateId }: { slateId: string }) {
  const [consented, setConsented] = useState(false);
  const [copied, setCopied] = useState(false);
  const deepLink = `lockin://slate/${slateId}`;

  const copyDeepLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Branded share card</p>
        <p className="text-xs text-muted">
          Auto-generated image with your handle and the live prize pool. Tapping
          the card&apos;s link opens this slate in the app.
        </p>
      </div>

      <label className="flex items-start gap-2.5 text-xs text-muted">
        <input
          type="checkbox"
          className="mt-0.5 accent-accent"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
        />
        <span>
          I consent to LockIn generating a shareable image that includes my
          creator handle for promoting this contest.
        </span>
      </label>

      <div className="grid grid-cols-3 gap-2">
        {SIZES.map((s) => (
          <a
            key={s.key}
            href={consented ? `/api/share-card/${slateId}?size=${s.key}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!consented}
            onClick={(e) => {
              if (!consented) e.preventDefault();
            }}
            className={
              "flex flex-col items-center gap-0.5 rounded border px-2 py-2.5 text-center text-xs transition-colors " +
              (consented
                ? "border-accent-border bg-accent-soft text-accent hover:bg-[rgba(255,59,0,0.16)]"
                : "cursor-not-allowed border-border text-muted opacity-50")
            }
          >
            <span className="font-medium">{s.label}</span>
            <span className="text-[10px] text-muted">{s.dims}</span>
          </a>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2">
        <code className="truncate text-xs text-accent">{deepLink}</code>
        <Button variant="ghost" size="sm" onClick={copyDeepLink}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </Card>
  );
}
