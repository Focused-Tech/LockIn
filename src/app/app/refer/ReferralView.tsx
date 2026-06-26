"use client";

import { useEffect, useState } from "react";
import { Card, Pill } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import {
  REFERRAL_PAID_BONUS_CENTS,
  REFERRAL_SIGNUP_COINS,
} from "@/lib/constants";
import type { ReferralDashboard } from "@/server/data/referrals";

export function ReferralView({ data }: { data: ReferralDashboard }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  const link = origin ? `${origin}/signup?ref=${encodeURIComponent(data.code)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Invite link */}
      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Your invite link</h2>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 flex-1 truncate rounded border border-border bg-surface px-3 text-xs text-foreground"
          />
          <button
            type="button"
            onClick={copy}
            className="h-9 shrink-0 rounded border border-accent-border bg-accent-soft px-3 text-xs font-medium text-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-muted">
          You earn {REFERRAL_SIGNUP_COINS} coins when a friend signs up, plus{" "}
          {formatCents(REFERRAL_PAID_BONUS_CENTS)} cash when they make their first
          deposit. They start with bonus coins too.
        </p>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-muted">Referred</p>
          <p className="mt-1 text-lg font-semibold">{data.totalReferred}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Converted</p>
          <p className="mt-1 text-lg font-semibold">{data.converted}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Cash earned</p>
          <p className="mt-1 text-lg font-semibold text-win">
            {formatCents(data.earningsCents)}
          </p>
        </Card>
      </div>

      {/* List */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Your referrals</h2>
        {data.referrals.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted">
            No referrals yet — share your link to start earning.
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded border border-border">
            {data.referrals.map((r) => (
              <li
                key={r.username}
                className="flex items-center justify-between bg-surface-card px-4 py-3"
              >
                <span className="text-sm font-medium">{r.username}</span>
                <div className="flex items-center gap-2">
                  {r.rewardCents > 0 && (
                    <span className="text-sm font-semibold text-win">
                      {formatCents(r.rewardCents)}
                    </span>
                  )}
                  <Pill tone={r.status === "converted" ? "win" : "neutral"}>
                    {r.status === "converted" ? "Converted" : "Signed up"}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
