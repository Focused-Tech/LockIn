"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/utils";
import { REFERRAL_SIGNUP_COINS } from "@/lib/constants";
import type { ReferralDashboard } from "@/server/data/referrals";

/**
 * REFER — code, copy, share, three-step how-it-works, earned so far. The reward
 * DIFFERS BY MODE: advanced earns cash credit, beginner earns coins. Never renders
 * the other currency (two-currency rule).
 */
export function ReferralView({
  data,
  advanced,
}: {
  data: ReferralDashboard;
  advanced: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  const link = origin ? `${origin}/signup?ref=${encodeURIComponent(data.code)}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link || data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function share() {
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
    if (nav.share && link) {
      try {
        await nav.share({ title: "LockIn", text: `Join me on LockIn — use my code ${data.code}`, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    copy();
  }

  const reward = advanced ? "$5 in contest credit" : "250 coins";
  // Referrer earns REFERRAL_SIGNUP_COINS per signup (both modes); advanced also earns cash.
  const coinsEarned = data.totalReferred * REFERRAL_SIGNUP_COINS;

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Code */}
      <div className="blk act">
        <div className="lb">Your code <i></i></div>
        <div className="code">
          <div className="c">{data.code.toUpperCase()}</div>
          <button type="button" className="btn" style={{ flex: "none", padding: "13px 15px" }} onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="btns">
          <button type="button" className="btn pri" onClick={share}>
            Share invite
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="blk">
        <div className="lb">How it works <i></i></div>
        <div className="step">
          <div className="k">1</div>
          <div className="n">
            <b>Send your code</b>
            <span>Any friend who has never played.</span>
          </div>
        </div>
        <div className="step">
          <div className="k">2</div>
          <div className="n">
            <b>They play a slate</b>
            <span>Their first contest, any category.</span>
          </div>
        </div>
        <div className="step">
          <div className="k">3</div>
          <div className="n">
            <b>You both get {reward}</b>
            <span>Credited once their first slate settles.</span>
          </div>
        </div>
      </div>

      {/* Earned so far */}
      <div className={"blk " + (advanced ? "money" : "coin")}>
        <div className="lb">Earned so far <i></i></div>
        <div className="row static">
          <span className="n"><b>Friends joined</b></span>
          <span className="val">{data.totalReferred}</span>
        </div>
        <div className="row static">
          <span className="n"><b>Converted</b></span>
          <span className="val">{data.converted}</span>
        </div>
        <div className="row static">
          <span className="n"><b>Rewards earned</b></span>
          {advanced ? (
            <span className="val cash">{formatCents(data.earningsCents)}</span>
          ) : (
            <span className="val coin">{coinsEarned.toLocaleString()}</span>
          )}
        </div>
      </div>

      {data.referrals.length > 0 && (
        <div className="blk">
          <div className="lb">Your referrals <i></i></div>
          {data.referrals.map((r) => (
            <div key={r.username} className="row static">
              <span className="n"><b>@{r.username}</b></span>
              <span className={"val " + (r.status === "converted" ? "cash" : "muted")}>
                {r.status === "converted" ? "Converted" : "Signed up"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="hint">
        Invites are one per person. Self-referrals and duplicate accounts do not qualify.
      </p>
    </div>
  );
}
