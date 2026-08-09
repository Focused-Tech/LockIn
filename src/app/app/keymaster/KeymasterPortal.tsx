"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import type { KeymasterRow } from "@/server/data/keyholder";
import { keymasterEnroll, keymasterRevoke, keymasterSearch, type KmSearchRow } from "./actions";

/**
 * KEYMASTER PORTAL view — roll-up, the downline tree (with revoke), and enrolment. All mutations go
 * through the server-guarded actions; the UI only reflects the guards. Projected dollars render "—"
 * while the architect's rates are unset.
 */
export function KeymasterPortal({
  code,
  tree,
}: {
  code: string;
  tree: { keyholders: KeymasterRow[]; rollup: { creators: number; players: number; totalEntries: number; totalProjectedCents: number | null } };
}) {
  const [rows, setRows] = useState<KeymasterRow[]>(tree.keyholders);
  const rollup = tree.rollup;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<KmSearchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const money = (c: number | null) => (c == null ? "—" : formatCents(c));

  async function runSearch() {
    setBusy(true);
    setNote(null);
    try {
      setResults(await keymasterSearch(q));
    } finally {
      setBusy(false);
    }
  }

  async function enroll(uid: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await keymasterEnroll(uid);
      if (!res.ok) setNote(res.error);
      else {
        setNote("Enrolled as a keyholder in your tree.");
        setResults((prev) => prev.map((r) => (r.uid === uid ? { ...r, keyholder: true, inMyTree: true } : r)));
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke(uid: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await keymasterRevoke(uid);
      if (!res.ok) setNote(res.error);
      else setRows((prev) => prev.filter((r) => r.uid !== uid));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lk-acct flex flex-col gap-4 px-4 pb-24 pt-6">
      <div className="phd">
        <div className="n">
          <b>Keymaster portal</b>
          <span>Your tree, your roll-up, and enrolment. Code: {code.toUpperCase()}</span>
        </div>
      </div>

      {/* Roll-up */}
      <div className="blk money">
        <div className="lb">Roll-up <i></i></div>
        <div className="row static">
          <span className="n"><b>Creators</b><span>Across your tree</span></span>
          <span className="val">{rollup.creators}</span>
        </div>
        <div className="row static">
          <span className="n"><b>Players</b></span>
          <span className="val">{rollup.players}</span>
        </div>
        <div className="row static">
          <span className="n"><b>Total entries</b></span>
          <span className="val">{rollup.totalEntries}</span>
        </div>
        <div className="row static">
          <span className="n"><b>Projected earnings</b></span>
          <span className="val cash">{money(rollup.totalProjectedCents)}</span>
        </div>
      </div>

      {/* Enrol */}
      <div className="blk act">
        <div className="lb">Enrol a keyholder <i></i></div>
        <div className="code">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder="username"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
          />
          <button type="button" className="btn" style={{ flex: "none", padding: "13px 15px" }} disabled={busy} onClick={() => void runSearch()}>
            Search
          </button>
        </div>
        {note && <p className="hint" style={{ marginTop: 10 }}>{note}</p>}
        {results.map((r) => (
          <div key={r.uid} className="row static">
            <span className="n"><b>@{r.username}</b><span>{r.inMyTree ? "In your tree" : r.keyholder ? "Keyholder (another tree)" : "Not a keyholder"}</span></span>
            {r.inMyTree ? (
              <span className="val muted">Enrolled</span>
            ) : (
              <button type="button" className="btn" style={{ flex: "none", padding: "8px 14px" }} disabled={busy} onClick={() => void enroll(r.uid)}>
                Enrol
              </button>
            )}
          </div>
        ))}
        <p className="hint" style={{ marginTop: 10 }}>You can grant the keyholder role only, and only into your own tree.</p>
      </div>

      {/* Downline tree */}
      <div className="blk">
        <div className="lb">Your keyholders <i></i></div>
        {rows.length === 0 ? (
          <p className="hint">No keyholders in your tree yet — enrol one above.</p>
        ) : (
          rows.map((k) => (
            <div key={k.uid} className="row static">
              <span className="n"><b>@{k.username}</b><span>{k.creators} creators · {k.players} players · {k.totalEntries} entries</span></span>
              <button type="button" className="btn" style={{ flex: "none", padding: "8px 12px" }} disabled={busy} onClick={() => void revoke(k.uid)}>
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
