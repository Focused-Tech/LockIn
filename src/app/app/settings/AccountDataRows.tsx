"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMyAccount,
  getDeletionStatus,
  getMyDataExport,
  type DeletionStatus,
} from "./actions";
import type { Blocker } from "@/server/account/blockers";

/**
 * The two rows in Settings that used to be inert: "Download my data" and "Delete account".
 *
 * Both open an inline panel rather than navigating, so the user never loses their place, and both do
 * their real work on the server. The delete panel refuses to show a confirm control at all while a
 * blocker is live — you cannot type past it.
 */

function RowShell({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button type="button" className="row" onClick={onToggle} aria-expanded={open}>
        <span className="n">
          <b>{title}</b>
          {hint && <span>{hint}</span>}
        </span>
        {/* › is the canon arrow everywhere in the app — rotate it when open rather than swapping
            in a second glyph (see the chevron sweep in accountScreens.gate.test.ts). */}
        <span
          className="cv"
          aria-hidden
          style={{
            display: "inline-block",
            transition: "transform .15s",
            transform: open ? "rotate(90deg)" : undefined,
          }}
        >
          ›
        </span>
      </button>
      {open && <div style={{ paddingBottom: 4 }}>{children}</div>}
    </>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--edge)",
  borderRadius: 12,
  padding: 12,
  marginTop: 2,
};

/* ── Download my data ──────────────────────────────────────────────────────────────────────────── */

export function DownloadMyDataRow() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    { filename: string; json: string; sizeBytes: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError(null);
    start(async () => {
      const r = await getMyDataExport();
      if (r.ok) setResult({ filename: r.filename, json: r.json, sizeBytes: r.sizeBytes });
      else setError(r.error);
    });
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !result && !pending) load();
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy. Use “Save file” instead.");
    }
  };

  return (
    <RowShell
      title="Download my data"
      hint="Everything we hold about your account, as a file"
      open={open}
      onToggle={toggle}
    >
      <div style={panelStyle}>
        {pending && <p className="hint">Gathering your data…</p>}
        {error && <p className="hint" style={{ color: "var(--loss, #E85454)" }}>{error}</p>}

        {result && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              <b style={{ color: "#fff" }}>{result.filename}</b> · {(result.sizeBytes / 1024).toFixed(1)} KB
            </p>
            <div className="btns">
              <a
                className="btn pri"
                href="/api/account/export"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", lineHeight: "normal" }}
              >
                Save file
              </a>
              <button type="button" className="btn" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="hint">
              If the file doesn&apos;t save on your phone, use Copy — it puts the same data on your
              clipboard.
            </p>
            <details style={{ marginTop: 10 }}>
              <summary className="hint" style={{ cursor: "pointer" }}>
                Preview
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  maxHeight: 220,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "var(--grey)",
                }}
              >
                {result.json.slice(0, 4000)}
                {result.json.length > 4000 ? "\n…" : ""}
              </pre>
            </details>
          </>
        )}
      </div>
    </RowShell>
  );
}

/* ── Delete account ────────────────────────────────────────────────────────────────────────────── */

function BlockerList({ blockers }: { blockers: Blocker[] }) {
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {blockers.map((b) => (
        <li key={b.code} className="hint" style={{ marginTop: 6 }}>
          {b.message}
        </li>
      ))}
    </ul>
  );
}

export function DeleteAccountRow() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const load = () => {
    setError(null);
    start(async () => {
      const r = await getDeletionStatus();
      if ("error" in r) setError(r.error);
      else setStatus(r);
    });
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !status && !pending) load();
  };

  const doDelete = () => {
    setError(null);
    startDelete(async () => {
      const r = await deleteMyAccount(confirm);
      if (r.ok) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setError(r.error);
      if (r.blockers) setStatus((s) => (s ? { ...s, blockers: r.blockers! } : s));
    });
  };

  const blocked = (status?.blockers.length ?? 0) > 0;
  const phraseOk =
    !!status && confirm.trim().toLowerCase() === status.confirmPhrase.toLowerCase();

  return (
    <RowShell
      title="Delete account"
      hint="Permanent. Open contests play out first."
      open={open}
      onToggle={toggle}
    >
      <div style={panelStyle}>
        {pending && <p className="hint" style={{ marginTop: 0 }}>Checking your account…</p>}

        {status && blocked && (
          <>
            <p className="hint" style={{ marginTop: 0, color: "#fff" }}>
              <b>Not yet — here&apos;s what&apos;s in the way:</b>
            </p>
            <BlockerList blockers={status.blockers} />
          </>
        )}

        {status && !blocked && (
          <>
            <p className="hint" style={{ marginTop: 0, color: "#fff" }}>
              <b>This cannot be undone.</b> You&apos;ll be signed out and your username is released.
            </p>

            <p className="hint" style={{ marginTop: 10, color: "#fff" }}>
              <b>Deleted</b>
            </p>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {status.removed.map((w) => (
                <li key={w} className="hint" style={{ marginTop: 4 }}>
                  {w}
                </li>
              ))}
            </ul>

            <p className="hint" style={{ marginTop: 12, color: "#fff" }}>
              <b>Kept, with your name taken off</b>
            </p>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {status.kept.map((w) => (
                <li key={w} className="hint" style={{ marginTop: 4 }}>
                  {w}
                </li>
              ))}
            </ul>

            <label className="hint" style={{ display: "block", marginTop: 14 }}>
              Type <b style={{ color: "#fff" }}>{status.confirmPhrase}</b> to confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Type your username to confirm deletion"
              style={{
                marginTop: 6,
                width: "100%",
                borderRadius: 10,
                border: "1px solid var(--edge)",
                background: "#0d1118",
                color: "#fff",
                padding: "11px 12px",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />

            <div className="btns">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setOpen(false);
                  setConfirm("");
                }}
              >
                Keep my account
              </button>
              <button
                type="button"
                className="btn pri"
                disabled={!phraseOk || deleting}
                onClick={doDelete}
                style={!phraseOk || deleting ? { opacity: 0.5 } : undefined}
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="hint" style={{ marginTop: 10, color: "var(--loss, #E85454)" }}>
            {error}
          </p>
        )}
      </div>
    </RowShell>
  );
}
