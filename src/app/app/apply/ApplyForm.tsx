"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import { submitCreatorApplication } from "./actions";

export function ApplyForm({ rejectedNote }: { rejectedNote?: string | null }) {
  const router = useRouter();
  const [audienceUrl, setAudienceUrl] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pitch, setPitch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    setPicked((p) =>
      p.includes(name) ? p.filter((c) => c !== name) : [...p, name],
    );
  }

  async function onSubmit() {
    setError(null);
    setPending(true);
    const result = await submitCreatorApplication({
      audienceUrl: audienceUrl.trim(),
      audienceSize: Number(audienceSize) || 0,
      categories: picked,
      pitch: pitch.trim(),
    });
    setPending(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {rejectedNote && (
        <div className="rounded border border-[rgba(232,84,84,0.25)] bg-[rgba(232,84,84,0.10)] px-4 py-3 text-sm text-loss">
          Your last application wasn&apos;t approved: {rejectedNote}. You can
          update and resubmit below.
        </div>
      )}

      <Card className="flex flex-col gap-2">
        <label className="text-sm font-medium">Primary channel link</label>
        <Input
          type="url"
          inputMode="url"
          placeholder="https://youtube.com/@yourchannel"
          value={audienceUrl}
          onChange={(e) => setAudienceUrl(e.target.value)}
        />
      </Card>

      <Card className="flex flex-col gap-2">
        <label className="text-sm font-medium">Audience size</label>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="e.g. 25000"
          value={audienceSize}
          onChange={(e) => setAudienceSize(e.target.value)}
        />
        <p className="text-xs text-muted">
          Total followers/subscribers across your main platform.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <label className="text-sm font-medium">Categories you&apos;d host</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = picked.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggle(c.name)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                  (on
                    ? "border-accent-border bg-accent-soft text-accent"
                    : "border-border text-muted hover:text-foreground")
                }
              >
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-2">
        <label className="text-sm font-medium">Why you&apos;d be a great host</label>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Tell us about your audience, how you'd promote contests, and why your community would love LockIn."
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent-border"
        />
      </Card>

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
        disabled={pending}
        onClick={onSubmit}
      >
        {pending ? "Submitting…" : "Submit application"}
      </Button>
    </div>
  );
}
