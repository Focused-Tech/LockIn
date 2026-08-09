"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { KeyholderPipeline, CreatorPipelineRow } from "@/server/data/keyholderPipeline";

/**
 * KEYHOLDER PORTAL — a WORK SURFACE (Parts 4–5). Tabs: My Key (two links off one code + QR + share),
 * My Creators (pipeline stages with time-stuck; "—" where a stage's data doesn't exist), My Players,
 * My Earnings (projected, by trigger band), My Keymaster. Reused read-only for the keymaster/admin
 * drill-in (hideHeader + bannerName names whose data it is). No payout control anywhere.
 */
type Tab = "key" | "creators" | "players" | "earnings" | "keymaster";

const PROJECTED = "PROJECTED — rates pending final approval";

function stuckLabel(ms: number | null): string {
  if (ms == null) return "—";
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h`;
  return "just now";
}
function pctLabel(p: number | null): string {
  return p == null ? "—" : `${(p * 100).toFixed(2)}%`;
}

export function KeyholderPortal({
  pipeline,
  hideHeader = false,
  bannerName,
}: {
  pipeline: KeyholderPipeline;
  hideHeader?: boolean;
  bannerName?: string;
}) {
  const [tab, setTab] = useState<Tab>("key");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  const code = pipeline.code;
  const playerLink = origin ? `${origin}/signup?ref=${encodeURIComponent(code)}` : "";
  const creatorLink = origin ? `${origin}/signup?ref=${encodeURIComponent(code)}&as=creator` : "";

  useEffect(() => {
    if (playerLink) QRCode.toDataURL(playerLink, { margin: 1, width: 176 }).then(setQr).catch(() => setQr(null));
  }, [playerLink]);

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* blocked */
    }
  }
  async function share(url: string) {
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) await nav.share({ title: "Lock In", url }).catch(() => {});
    else void copy(url, "share");
  }

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {bannerName && (
        <div className="blk act">
          <p className="hint" style={{ color: "#fff" }}>Read-only — viewing @{bannerName}&apos;s data.</p>
        </div>
      )}
      {!hideHeader && (
        <div className="phd">
          <div className="n">
            <b>Keyholder portal</b>
            <span>Your key, your pipeline, your projected earnings.</span>
          </div>
        </div>
      )}

      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {(["key", "creators", "players", "earnings", "keymaster"] as Tab[]).map((t) => (
          <button key={t} type="button" className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "key" ? "My key" : t === "creators" ? "Creators" : t === "players" ? "Players" : t === "earnings" ? "Earnings" : "Keymaster"}
          </button>
        ))}
      </div>

      {tab === "key" && (
        <>
          <div className="blk act">
            <div className="lb">Your code <i></i></div>
            <div className="code"><div className="c">{code.toUpperCase()}</div></div>
            {qr && (
              <div className="mt-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Invite QR" width={176} height={176} style={{ borderRadius: 12, background: "#fff", padding: 6 }} />
              </div>
            )}
          </div>

          <div className="blk">
            <div className="lb">Two links, one code <i></i></div>
            <div className="row static">
              <span className="n"><b>Player invite</b><span>Lands on normal signup</span></span>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className="btn" style={{ flex: "none", padding: "8px 12px" }} onClick={() => void copy(playerLink, "player")}>{copied === "player" ? "Copied" : "Copy"}</button>
                <button type="button" className="btn pri" style={{ flex: "none", padding: "8px 12px" }} onClick={() => void share(playerLink)}>Share</button>
              </div>
            </div>
            <div className="row static">
              <span className="n"><b>Creator invite</b><span>Lands on creator onboarding</span></span>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" className="btn" style={{ flex: "none", padding: "8px 12px" }} onClick={() => void copy(creatorLink, "creator")}>{copied === "creator" ? "Copied" : "Copy"}</button>
                <button type="button" className="btn pri" style={{ flex: "none", padding: "8px 12px" }} onClick={() => void share(creatorLink)}>Share</button>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>Same attribution, different destination — both credit your code.</p>
          </div>
        </>
      )}

      {tab === "creators" && (
        <div className="blk">
          <div className="lb">My creators — pipeline <i></i></div>
          {pipeline.creators.length === 0 ? (
            <p className="hint">No referred creators yet.</p>
          ) : (
            pipeline.creators.map((c: CreatorPipelineRow) => (
              <div key={c.uid} className="row static">
                <span className="n">
                  <b>@{c.username}</b>
                  <span>{c.stageLabel} · stuck {stuckLabel(c.stuckMs)} · participation {pctLabel(c.participationPct)}</span>
                </span>
                <span className="val muted">{c.stage === "participating" ? "live" : c.stageLabel.split(" ")[0]}</span>
              </div>
            ))
          )}
          <p className="hint" style={{ marginTop: 10 }}>Pay triggers on participation — watch who&apos;s stuck before &ldquo;settled&rdquo;. A stage with no data shows &ldquo;—&rdquo;.</p>
        </div>
      )}

      {tab === "players" && (
        <div className="blk">
          <div className="lb">My players <i></i></div>
          <div className="row static"><span className="n"><b>Referred</b></span><span className="val">{pipeline.players.referred}</span></div>
          <div className="row static"><span className="n"><b>Deposited</b></span><span className="val">{pipeline.players.deposited == null ? "—" : pipeline.players.deposited}</span></div>
          <div className="row static"><span className="n"><b>Qualified</b></span><span className="val">{pipeline.players.qualified}</span></div>
          <div className="row static"><span className="n"><b>Pending</b><span>Signed up, not yet qualified</span></span><span className="val muted">{pipeline.players.pending}</span></div>
        </div>
      )}

      {tab === "earnings" && (
        <>
          <div className="blk money">
            <div className="lb">Projected earnings — by band <i></i></div>
            {pipeline.earningsByBand.length === 0 ? (
              <p className="hint">No creator activity yet.</p>
            ) : (
              pipeline.earningsByBand.map((b) => (
                <div key={b.band} className="row static">
                  <span className="n"><b>{b.band}</b><span>{b.creators} creator{b.creators === 1 ? "" : "s"}</span></span>
                  <span className="val cash">{b.projectedCents == null ? "—" : b.projectedCents}</span>
                </div>
              ))
            )}
          </div>
          <p className="hint">{PROJECTED}. A 2% creator and a 10% creator read differently; dollars appear once rates are approved.</p>
        </>
      )}

      {tab === "keymaster" && (
        <div className="blk">
          <div className="lb">My keymaster <i></i></div>
          {pipeline.keymasterUsername ? (
            <>
              <div className="row static"><span className="n"><b>@{pipeline.keymasterUsername}</b><span>Your upline</span></span></div>
              <p className="hint" style={{ marginTop: 10 }}>Reach them with their code: {pipeline.keymasterUsername.toUpperCase()}.</p>
            </>
          ) : (
            <p className="hint">You&apos;re not in a keymaster&apos;s downline yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
