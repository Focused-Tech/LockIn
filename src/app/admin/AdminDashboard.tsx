"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Pill } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import {
  approveCreator,
  rejectCreator,
  setCreatorVerified,
} from "./creators/actions";

export interface PendingRow {
  userId: string;
  username: string;
  audienceUrl: string;
  audienceSize: number;
  categories: string[];
  pitch: string;
  createdAtMs: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isCreator: boolean;
  creatorVerified: boolean;
  kycStatus: string;
  coinBalance: number;
  cashBalanceCents: number;
}

export interface AdminSlateRow {
  id: string;
  title: string;
  category: string;
  status: string;
  creatorId: string | null;
  entryCount: number;
}

export function AdminDashboard({
  ownUid,
  ownUsername,
  ownIsCreatorVerified,
  pending,
  creators,
  slates,
  users,
  userCount,
  slateCount,
}: {
  ownUid: string;
  ownUsername: string;
  ownIsCreatorVerified: boolean;
  pending: PendingRow[];
  creators: AdminUserRow[];
  slates: AdminSlateRow[];
  users: AdminUserRow[];
  userCount: number;
  slateCount: number;
}) {
  const router = useRouter();
  const [pendingAction, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      setMsg(null);
      setErr(null);
      const res = await fn();
      if (res.ok) {
        setMsg(ok);
        router.refresh();
      } else {
        setErr(res.error ?? "Action failed");
      }
    });

  return (
    <div className="flex flex-col gap-6">
      {/* Owner / self-approve */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Pill tone="accent">Admin</Pill>
          <span className="text-sm">
            Signed in as <span className="font-semibold">{ownUsername}</span>
          </span>
        </div>
        {ownIsCreatorVerified ? (
          <p className="text-sm text-muted">
            Your account is a verified creator — you can host contests.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Your account is not a creator yet.
            </p>
            <Button
              variant="accent"
              size="sm"
              disabled={pendingAction}
              onClick={() =>
                run(
                  () => setCreatorVerified(ownUid, true),
                  "Your account is now a verified creator.",
                )
              }
            >
              Approve my own account
            </Button>
          </div>
        )}
      </Card>

      {(msg || err) && (
        <p
          className={
            "rounded border px-3 py-2 text-sm " +
            (err
              ? "border-loss-border bg-loss-soft text-loss"
              : "border-win-border bg-win-soft text-win")
          }
        >
          {err ?? msg}
        </p>
      )}

      {/* Pending creator applications */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Pending creator applications ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">
            No applications waiting.
          </Card>
        ) : (
          pending.map((p) => (
            <Card key={p.userId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">@{p.username}</span>
                <span className="text-xs text-muted">
                  {p.audienceSize.toLocaleString()} audience
                </span>
              </div>
              <a
                href={p.audienceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-ai hover:underline"
              >
                {p.audienceUrl}
              </a>
              <p className="text-xs text-muted">{p.categories.join(", ")}</p>
              <p className="text-sm">{p.pitch}</p>
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  disabled={pendingAction}
                  onClick={() =>
                    run(
                      () => approveCreator(p.userId),
                      `Approved @${p.username}.`,
                    )
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingAction}
                  onClick={() => {
                    const note = window.prompt(
                      `Reason for rejecting @${p.username}?`,
                      "",
                    );
                    if (note && note.trim().length >= 3) {
                      run(
                        () => rejectCreator(p.userId, note),
                        `Rejected @${p.username}.`,
                      );
                    }
                  }}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Verified creators */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          Verified creators ({creators.length})
        </h2>
        {creators.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">
            No verified creators yet.
          </Card>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded border border-border">
            {creators.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between bg-surface-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    @{c.username}
                    {c.isAdmin && <Pill tone="accent">admin</Pill>}
                  </p>
                  <p className="truncate text-xs text-muted">{c.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingAction}
                  onClick={() =>
                    run(
                      () => setCreatorVerified(c.id, false),
                      `Revoked @${c.username}.`,
                    )
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Platform state */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Platform state</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total users" value={userCount.toLocaleString()} />
          <StatCard label="Total slates" value={slateCount.toLocaleString()} />
        </div>
      </section>

      {/* Recent slates (read-only) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Recent slates ({slates.length})</h2>
        <ul className="flex flex-col overflow-hidden rounded border border-border">
          {slates.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 bg-surface-card px-4 py-2.5"
            >
              <div className="min-w-0">
                <Link
                  href={`/app/slate/${s.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {s.title}
                </Link>
                <p className="text-xs text-muted">
                  {s.category} · {s.entryCount} entries
                </p>
              </div>
              <Pill tone="neutral">{s.status}</Pill>
            </li>
          ))}
        </ul>
      </section>

      {/* Recent users (read-only) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Recent users ({users.length})</h2>
        <ul className="flex flex-col overflow-hidden rounded border border-border">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 bg-surface-card px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  @{u.username}
                  {u.isAdmin && <Pill tone="accent">admin</Pill>}
                  {u.creatorVerified && <Pill tone="win">creator</Pill>}
                </p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {u.coinBalance}c · {formatCents(u.cashBalanceCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface-card px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
