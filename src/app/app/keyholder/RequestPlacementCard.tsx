"use client";

import { useState } from "react";
import { requestPlacement } from "./actions";

/**
 * A keyholder with NO upline can REQUEST placement in a keymaster's downline (their only tree action —
 * they cannot enrol anyone or make keys). Shows the pending/resolved status once requested.
 */
export function RequestPlacementCard({
  initial,
}: {
  initial: { keymasterUsername: string; status: string } | null;
}) {
  const [request, setRequest] = useState(initial);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setNote(null);
    try {
      const res = await requestPlacement(code);
      if (!res.ok) setNote(res.error);
      else setRequest({ keymasterUsername: code.trim(), status: "pending" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="blk act">
      <div className="lb">Join a keymaster <i></i></div>
      {request && request.status === "pending" ? (
        <p className="hint">Request sent to @{request.keymasterUsername} — waiting for them to approve.</p>
      ) : request && request.status === "declined" ? (
        <p className="hint">Your last request was declined. You can send a new one below.</p>
      ) : null}
      {(!request || request.status !== "pending") && (
        <>
          <div className="code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="keymaster code"
              className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-border"
            />
            <button type="button" className="btn pri" style={{ flex: "none", padding: "13px 16px" }} disabled={busy} onClick={() => void submit()}>
              Request
            </button>
          </div>
          {note && <p className="hint" style={{ marginTop: 10 }}>{note}</p>}
          <p className="hint" style={{ marginTop: 10 }}>Ask a keymaster for their code, then request to join their downline. They approve it.</p>
        </>
      )}
    </div>
  );
}
