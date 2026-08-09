"use client";

import { useState } from "react";
import Link from "next/link";
import { searchUsers, listKeymasters, type AdminUserRow } from "./search";
import { setKeyholder, setKeymaster } from "./actions";

/**
 * ADMIN keyholder toggles (client). Search → rows → toggle keyholder / keymaster / upline. Every
 * mutation calls an EXISTING server action; keymaster-implies-keyholder is server-enforced (we just
 * re-read the row afterward and reflect it). No bulk ops, no delete, no payout.
 */
export function AdminKeyholders({ initialKeymasters }: { initialKeymasters: AdminUserRow[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [keymasters, setKeymasters] = useState<AdminUserRow[]>(initialKeymasters);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function runSearch() {
    setBusy(true);
    setNote(null);
    try {
      setRows(await searchUsers(q));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    // Re-read the current search + the keymaster picker so UI reflects server-enforced invariants.
    const [r, k] = await Promise.all([q.trim() ? searchUsers(q) : Promise.resolve(rows), listKeymasters()]);
    setRows(r);
    setKeymasters(k);
  }

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fn();
      if (!res.ok) setNote(res.error ?? "Action failed");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      <div className="phd">
        <div className="n">
          <b>Keyholder roles</b>
          <span>Search a user, then toggle their roles and upline.</span>
        </div>
      </div>

      <div className="blk act">
        <div className="lb">Find a user <i></i></div>
        <div className="code">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
            placeholder="username"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
          />
          <button type="button" className="btn" style={{ flex: "none", padding: "13px 15px" }} disabled={busy} onClick={() => void runSearch()}>
            Search
          </button>
        </div>
        {note && <p className="hint" style={{ marginTop: 10, color: "var(--bad)" }}>{note}</p>}
      </div>

      {rows.length > 0 && (
        <div className="blk">
          <div className="lb">Results <i></i></div>
          {rows.map((r) => (
            <div key={r.uid} className="row static" style={{ display: "block" }}>
              <div className="flex items-center gap-2">
                <span className="n" style={{ flex: 1 }}>
                  <b>@{r.username}</b>
                  <span>
                    {r.keymaster ? "Keymaster · " : ""}
                    {r.keyholder ? "Keyholder" : "Not a keyholder"}
                    {r.keymasterUid ? ` · upline ${uplineName(keymasters, r.keymasterUid)}` : ""}
                  </span>
                </span>
              </div>
              <div className="btns" style={{ marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn" disabled={busy} onClick={() => void act(() => setKeyholder(r.uid, !r.keyholder, r.keymasterUid))}>
                  {r.keyholder ? "Revoke keyholder" : "Make keyholder"}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void act(() => setKeymaster(r.uid, !r.keymaster))}>
                  {r.keymaster ? "Revoke keymaster" : "Make keymaster"}
                </button>
              </div>
              {/* Forwards (Features 2 + 3) — performance view and the user's profile. */}
              <div className="btns" style={{ marginTop: 8 }}>
                <Link href={`/admin/keyholders/${r.uid}`} className="btn" style={{ textAlign: "center", textDecoration: "none" }}>
                  View performance
                </Link>
                <Link href={`/admin/users/${r.uid}`} className="btn" style={{ textAlign: "center", textDecoration: "none" }}>
                  Profile
                </Link>
              </div>
              {/* Upline picker — limited to keymasters; only meaningful for a keyholder. */}
              <div className="btns" style={{ marginTop: 8 }}>
                <select
                  value={r.keymasterUid ?? ""}
                  disabled={busy || !r.keyholder}
                  onChange={(e) => void act(() => setKeyholder(r.uid, true, e.target.value || null))}
                  className="btn"
                  style={{ flex: 1, appearance: "auto" }}
                >
                  <option value="">No upline</option>
                  {keymasters
                    .filter((k) => k.uid !== r.uid)
                    .map((k) => (
                      <option key={k.uid} value={k.uid}>
                        {k.username}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function uplineName(keymasters: AdminUserRow[], uid: string): string {
  return keymasters.find((k) => k.uid === uid)?.username ?? uid.slice(0, 6);
}
