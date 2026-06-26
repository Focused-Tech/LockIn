"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Pill } from "@/components/ui";
import { approveCreator, rejectCreator } from "./actions";

export interface ReviewRow {
  userId: string;
  username: string;
  audienceUrl: string;
  audienceSize: number;
  categories: string[];
  pitch: string;
  createdAtMs: number;
}

export function AdminReviewList({ rows }: { rows: ReviewRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted">
        No pending applications.
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <ReviewCard key={r.userId} row={r} />
      ))}
    </ul>
  );
}

function ReviewCard({ row }: { row: ReviewRow }) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "approve" | "reject">(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setError(null);
    setPending("approve");
    const res = await approveCreator(row.userId);
    if (res.ok) router.refresh();
    else {
      setError(res.error);
      setPending(null);
    }
  }

  async function reject() {
    setError(null);
    setPending("reject");
    const res = await rejectCreator(row.userId, note);
    if (res.ok) router.refresh();
    else {
      setError(res.error);
      setPending(null);
    }
  }

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">@{row.username}</p>
          <span className="text-xs text-muted">
            {row.audienceSize.toLocaleString()} audience
          </span>
        </div>

        <a
          href={row.audienceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-sm text-ai underline"
        >
          {row.audienceUrl}
        </a>

        <div className="flex flex-wrap gap-1.5">
          {row.categories.map((c) => (
            <Pill key={c} tone="neutral">
              {c}
            </Pill>
          ))}
        </div>

        <p className="whitespace-pre-wrap text-sm text-muted">{row.pitch}</p>

        {error && <p className="text-sm text-loss">{error}</p>}

        {rejecting ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason (shown to applicant)…"
              className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent-border"
            />
            <div className="flex gap-2">
              <Button
                variant="neutral"
                size="sm"
                disabled={pending !== null}
                onClick={reject}
              >
                {pending === "reject" ? "Rejecting…" : "Confirm reject"}
              </Button>
              <Button
                variant="neutral"
                size="sm"
                disabled={pending !== null}
                onClick={() => setRejecting(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="accent"
              size="sm"
              disabled={pending !== null}
              onClick={approve}
            >
              {pending === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="neutral"
              size="sm"
              disabled={pending !== null}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
