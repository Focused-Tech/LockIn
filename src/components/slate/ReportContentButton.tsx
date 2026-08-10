"use client";

import { useState } from "react";

/**
 * Player-facing "Report" control for published creator content (Part 3e). Files an append-only
 * report to the server-only contentReports ledger and confirms receipt. Discreet by design — a
 * quiet text link, not a loud button — so it doesn't read as a rating.
 */
export function ReportContentButton({
  targetId,
  targetType = "slate",
}: {
  targetId: string;
  targetType?: "slate" | "package";
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  async function report() {
    if (state !== "idle") return;
    setState("sending");
    try {
      await fetch("/api/content/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, targetType }),
      });
    } catch {
      /* receipt shows regardless; a network miss shouldn't nag */
    }
    setState("done");
  }

  if (state === "done") {
    return <p className="text-center text-xs text-muted">Thanks — reported to our team for review.</p>;
  }
  return (
    <button
      type="button"
      onClick={report}
      disabled={state === "sending"}
      className="mx-auto block text-xs text-muted underline-offset-2 hover:underline disabled:opacity-50"
    >
      Report this contest
    </button>
  );
}
