"use client";

import { useEffect, useState } from "react";

/** Creator share tools: copyable iframe embed code + a shareable link. */
export function EmbedSnippet({ slateId }: { slateId: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"embed" | "link" | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const link = `${origin}/s/${slateId}`;
  const iframe = `<iframe src="${origin}/embed/${slateId}" width="360" height="460" style="border:0;border-radius:12px;overflow:hidden" title="LockIn contest" loading="lazy"></iframe>`;

  async function copy(text: string, which: "embed" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-border bg-surface-card p-4">
      <h2 className="text-sm font-semibold">Share &amp; embed</h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Share link</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 truncate rounded border border-border bg-surface px-3 text-xs text-foreground"
          />
          <button
            type="button"
            onClick={() => copy(link, "link")}
            className="h-9 shrink-0 rounded border border-accent-border bg-accent-soft px-3 text-xs font-medium text-accent"
          >
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">
          Embed code (websites, blogs, Linktree)
        </span>
        <textarea
          readOnly
          value={iframe}
          onFocus={(e) => e.currentTarget.select()}
          rows={3}
          className="resize-none rounded border border-border bg-surface px-3 py-2 text-xs text-foreground"
        />
        <button
          type="button"
          onClick={() => copy(iframe, "embed")}
          className="self-start rounded border border-accent-border bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
        >
          {copied === "embed" ? "Copied" : "Copy embed code"}
        </button>
      </div>
    </div>
  );
}
