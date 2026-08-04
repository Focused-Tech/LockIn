"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEPOSIT_LIMITS,
  NCPG_HOTLINE,
  SELF_EXCLUSION_PERIODS,
  type SelfExclusionKey,
} from "@/lib/constants";
import { formatCents } from "@/lib/utils";
import { setSelfExclusion, updateDepositLimits } from "./actions";

interface Limits {
  dailyCents: number;
  weeklyCents: number;
  monthlyCents: number;
}

/** A local (device) preference toggle backed by localStorage. */
function useLocalPref(key: string, dflt: boolean): [boolean, () => void] {
  const [on, setOn] = useState(dflt);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v != null) setOn(v === "1");
    } catch {
      /* ignore */
    }
  }, [key]);
  return [
    on,
    () => {
      const next = !on;
      setOn(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
  ];
}

/**
 * RESPONSIBLE PLAY — panel language, mode-aware. ADVANCED keeps the real deposit-limit
 * and self-exclusion actions. BEGINNER states plainly that no money can move, so deposit
 * limits do not apply — it keeps the reminder, break and support controls. The interactive
 * limit/exclusion logic is unchanged; only the presentation moved to the panel language.
 */
export function ResponsiblePlayView({
  advanced,
  limits,
  usage,
  exclusionUntilMs,
  permanent,
}: {
  advanced: boolean;
  limits: Limits;
  usage: Limits;
  exclusionUntilMs: number;
  permanent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [daily, setDaily] = useState(String(limits.dailyCents / 100));
  const [weekly, setWeekly] = useState(String(limits.weeklyCents / 100));
  const [monthly, setMonthly] = useState(String(limits.monthlyCents / 100));

  const [remind, toggleRemind] = useLocalPref("lockin.rp.remind", false);
  const [spend, toggleSpend] = useLocalPref("lockin.rp.spend", false);

  const excluded = exclusionUntilMs > 0;

  function saveLimits() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDepositLimits({
        dailyCents: Math.round((parseFloat(daily) || 0) * 100),
        weeklyCents: Math.round((parseFloat(weekly) || 0) * 100),
        monthlyCents: Math.round((parseFloat(monthly) || 0) * 100),
      });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else setError(result.error);
    });
  }

  function exclude(key: SelfExclusionKey, label: string) {
    const msg =
      key === "permanent"
        ? "Permanently self-exclude? This CANNOT be undone."
        : `Self-exclude for ${label}? This can't be shortened once set.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const result = await setSelfExclusion(key);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      {excluded && (
        <div className="blk warn">
          <b className="block text-[15px] font-semibold text-white">Your account is self-excluded</b>
          <p className="hint mt-1.5">
            {permanent
              ? "This exclusion is permanent."
              : `Play and deposits are paused until ${new Date(exclusionUntilMs).toLocaleString()}.`}
          </p>
        </div>
      )}

      {advanced ? (
        <>
          {/* Deposit limits */}
          <div className="blk money">
            <div className="lb">Deposit limits <i></i></div>
            <LimitRow label="Daily" value={daily} onChange={setDaily} cap={DEPOSIT_LIMITS.dailyCents} used={usage.dailyCents} />
            <LimitRow label="Weekly" value={weekly} onChange={setWeekly} cap={DEPOSIT_LIMITS.weeklyCents} used={usage.weeklyCents} />
            <LimitRow label="Monthly" value={monthly} onChange={setMonthly} cap={DEPOSIT_LIMITS.monthlyCents} used={usage.monthlyCents} />
            <div className="btns">
              <button type="button" className="btn pri" disabled={pending} onClick={saveLimits}>
                {pending ? "Saving…" : "Save limits"}
              </button>
            </div>
            {saved && <p className="hint mt-2" style={{ color: "#2fb98a" }}>Limits updated.</p>}
            <p className="hint mt-3">Lowering a limit applies right away. Raising one takes effect after a waiting period.</p>
          </div>

          {/* Staying in control */}
          <div className="blk">
            <div className="lb">Staying in control <i></i></div>
            <TgRow title="Session reminder" hint="Nudge me after an hour of play" on={remind} onFlip={toggleRemind} />
            <TgRow title="Weekly spend summary" hint="Email me what I entered and won" on={spend} onFlip={toggleSpend} />
            <div className="row static">
              <span className="n"><b>Entry limit</b><span>Cap what you can put into contests</span></span>
              <span className="val muted">Not set</span>
            </div>
          </div>
        </>
      ) : (
        <div className="blk">
          <div className="lb">Beginner mode <i></i></div>
          <p className="hint">
            You are playing with coins. No money can be deposited, spent or won in this mode, so deposit limits do not apply.
          </p>
        </div>
      )}

      {/* Taking a break — self-exclusion (both modes; pauses play). */}
      <div className="blk warn">
        <div className="lb">Taking a break <i></i></div>
        <p className="hint" style={{ marginBottom: 10 }}>
          A break pauses entries, deposits and purchases. It can&apos;t be lifted early.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SELF_EXCLUSION_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => exclude(p.key, p.label)}
              style={p.key === "permanent" ? { color: "#E0432C" } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="hint mt-3">
          Self-exclusion cannot be reversed before it ends. You will be signed out and any open contests play out on their own.
        </p>
      </div>

      {error && (
        <div className="blk warn" role="alert">
          <p className="hint" style={{ color: "#FFB3A7" }}>{error}</p>
        </div>
      )}

      {/* Support */}
      <div className="blk">
        <div className="lb">Support <i></i></div>
        <p className="hint">
          If play stops being fun, help is available. Call the National Problem Gambling Helpline:{" "}
          <b className="text-white">{NCPG_HOTLINE}</b> — free, confidential, 24/7.
        </p>
      </div>

      <p className="legal">
        Skill-based prediction contest platform. Not gambling. Not sports betting. 18+.
      </p>
    </div>
  );
}

function TgRow({ title, hint, on, onFlip }: { title: string; hint?: string; on: boolean; onFlip: () => void }) {
  return (
    <div className="row static">
      <span className="n">
        <b>{title}</b>
        {hint && <span>{hint}</span>}
      </span>
      <button type="button" aria-pressed={on} className={"tg" + (on ? " on" : "")} onClick={onFlip} />
    </div>
  );
}

function LimitRow({
  label,
  value,
  onChange,
  cap,
  used,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  cap: number;
  used: number;
}) {
  return (
    <div className="row static">
      <span className="n">
        <b>{label} limit</b>
        <span>Used {formatCents(used)} · max {formatCents(cap)}</span>
      </span>
      <span className="flex items-center gap-1 text-[13.5px] text-[#98A0AE]">
        $
        <input
          type="number"
          inputMode="decimal"
          className="h-8 w-20 rounded-[8px] border border-[#232b37] bg-[#0D1117] px-2 text-right text-[13.5px] text-white outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </div>
  );
}
