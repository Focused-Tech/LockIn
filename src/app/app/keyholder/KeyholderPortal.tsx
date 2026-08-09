"use client";

import { useEffect, useState } from "react";
import { formatCents } from "@/lib/utils";
import type { KeyholderPortalData } from "@/server/data/keyholder";

/**
 * KEYHOLDER PORTAL view — Dashboard · My creators · Earnings (+ a keymaster tree). Panel language
 * from lk-panels.css. Every dollar figure is PROJECTED and labelled "rates pending final approval";
 * while the architect's rates are unset each amount renders "—". There is NO payout button anywhere.
 * Privacy: nothing here exposes pool rake, the creator-cut split, or LockIn's fee net.
 */

type Tab = "dashboard" | "creators" | "earnings";

const PROJECTED_LABEL = "PROJECTED — rates pending final approval";

function pctLabel(pct: number | null): string {
  return pct == null ? "—" : `${(pct * 100).toFixed(2)}%`;
}
/** A projected dollar figure, or "—" when unarmed / null. */
function money(cents: number | null, armed: boolean): string {
  return armed && cents != null ? formatCents(cents) : "—";
}

export function KeyholderPortal({ data, hideHeader = false }: { data: KeyholderPortalData; hideHeader?: boolean }) {
  const [tab, setTab] = useState<Tab>("dashboard");
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

  const { earnings } = data;

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {/* Header — suppressed when embedded in the admin performance view (it supplies its own). */}
      {!hideHeader && (
        <div className="phd">
          <div className="n">
            <b>Keyholder portal</b>
            <span>{data.isKeymaster ? "Keymaster · your keyholders + your referrals" : "Your referrals and projected earnings"}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button type="button" className={"tab" + (tab === "dashboard" ? " on" : "")} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button type="button" className={"tab" + (tab === "creators" ? " on" : "")} onClick={() => setTab("creators")}>My creators</button>
        <button type="button" className={"tab" + (tab === "earnings" ? " on" : "")} onClick={() => setTab("earnings")}>Earnings</button>
      </div>

      {tab === "dashboard" && (
        <>
          {/* Code + link */}
          <div className="blk act">
            <div className="lb">Your code <i></i></div>
            <div className="code">
              <div className="c">{data.code.toUpperCase()}</div>
              <button type="button" className="btn" style={{ flex: "none", padding: "13px 15px" }} onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="hint" style={{ marginTop: 10, wordBreak: "break-all" }}>{link || "…"}</p>
          </div>

          {/* Referral counts, split creator / player */}
          <div className="blk">
            <div className="lb">Referrals <i></i></div>
            <div className="row static">
              <span className="n"><b>Creators</b><span>Referred accounts now hosting</span></span>
              <span className="val">{data.counts.creators}</span>
            </div>
            <div className="row static">
              <span className="n"><b>Players</b><span>Referred accounts that qualified</span></span>
              <span className="val">{data.counts.players}</span>
            </div>
            <div className="row static">
              <span className="n"><b>Pending</b><span>Signed up, not yet qualified</span></span>
              <span className="val muted">{data.counts.pending}</span>
            </div>
          </div>
        </>
      )}

      {tab === "creators" && (
        <div className="blk">
          <div className="lb">My creators <i></i></div>
          {data.creators.length === 0 ? (
            <p className="hint">No referred creators have settled a paid contest yet.</p>
          ) : (
            data.creators.map((c) => (
              <div key={c.uid} className="row static">
                <span className="n">
                  <b>@{c.username} <span className="badge rank" style={{ marginLeft: 6 }}>{c.division}</span></b>
                  <span>
                    {c.eventsSettled} event{c.eventsSettled === 1 ? "" : "s"} · {c.totalEntries} entries · participation {pctLabel(c.latestParticipationPct)}
                  </span>
                </span>
                <span className="val muted">{c.bandStatus}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "earnings" && (
        <>
          <div className="blk money">
            <div className="lb">Projected earnings <i></i></div>
            <div className="row static">
              <span className="n"><b>From creators</b><span>Across settled events</span></span>
              <span className="val cash">{money(earnings.creatorProjectedCents, earnings.armed)}</span>
            </div>
            <div className="row static">
              <span className="n"><b>From players</b><span>{earnings.qualifiedPlayers} qualified</span></span>
              <span className="val cash">{money(earnings.playerProjectedCents, earnings.armed)}</span>
            </div>
            <div className="row static">
              <span className="n"><b>Total</b></span>
              <span className="val cash">{money(earnings.totalProjectedCents, earnings.armed)}</span>
            </div>
          </div>
          <p className="hint">{PROJECTED_LABEL}. Event tallies are live; dollar amounts appear once rates are approved.</p>
        </>
      )}

      {/* KEYMASTER tree — downline keyholders + roll-up. Shown on every tab for a keymaster. */}
      {data.keymaster && (
        <div className="blk">
          <div className="lb">Your keyholders <i></i></div>
          {data.keymaster.keyholders.length === 0 ? (
            <p className="hint">No keyholders are assigned under you yet.</p>
          ) : (
            <>
              {data.keymaster.keyholders.map((k) => (
                <div key={k.uid} className="row static">
                  <span className="n">
                    <b>@{k.username}</b>
                    <span>{k.creators} creators · {k.players} players · {k.totalEntries} entries</span>
                  </span>
                  <span className="val cash">{money(k.totalProjectedCents, earnings.armed)}</span>
                </div>
              ))}
              <div className="row static">
                <span className="n"><b>Roll-up</b><span>{data.keymaster.rollup.creators} creators · {data.keymaster.rollup.players} players · {data.keymaster.rollup.totalEntries} entries</span></span>
                <span className="val cash">{money(data.keymaster.rollup.totalProjectedCents, earnings.armed)}</span>
              </div>
            </>
          )}
          <p className="hint" style={{ marginTop: 10 }}>{PROJECTED_LABEL}.</p>
        </div>
      )}
    </div>
  );
}
