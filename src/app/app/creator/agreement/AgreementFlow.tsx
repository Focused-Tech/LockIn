"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
  ESIG_TEXT,
  SECTION_KEYS,
  type SectionKey,
} from "@/lib/creator/agreement";
import { signCreatorSection } from "./actions";

/**
 * CREATOR AGREEMENT — three sections, signed ONE AT A TIME. Continue stays disabled until
 * the box on THIS section is ticked, and the tick does NOT carry forward: each section
 * loads unsigned. Signing persists that section on Continue (server), so an abandoned flow
 * resumes at the next unsigned section. When all three are signed the gate opens and the
 * done screen shows.
 */
export function AgreementFlow({ initialSigned }: { initialSigned: SectionKey[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Persisted signatures (server truth) + this-session tick state.
  const [signed, setSigned] = useState<SectionKey[]>(initialSigned);
  const [ticked, setTicked] = useState<Record<string, boolean>>(() => {
    const t: Record<string, boolean> = {};
    for (const k of initialSigned) t[k] = true;
    return t;
  });
  // Start at the first UNSIGNED section.
  const firstUnsigned = SECTION_KEYS.findIndex((k) => !initialSigned.includes(k));
  const [i, setI] = useState(firstUnsigned < 0 ? SECTION_KEYS.length - 1 : firstUnsigned);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const section = AGREEMENT_SECTIONS[i]!;
  const isTicked = !!ticked[section.k];

  const railNodes = useMemo(() => SECTION_KEYS, []);

  function toggle() {
    setTicked((t) => ({ ...t, [section.k]: !t[section.k] }));
  }

  function onContinue() {
    if (done) {
      router.push("/app/creator");
      return;
    }
    if (!isTicked) return; // Continue is dead until the box is ticked
    setError(null);
    startTransition(async () => {
      const res = await signCreatorSection(section.k);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSigned(res.signed);
      if (res.onboarded) {
        setDone(true);
      } else if (i < AGREEMENT_SECTIONS.length - 1) {
        setI(i + 1);
      }
      if (typeof window !== "undefined") window.scrollTo(0, 0);
    });
  }

  function onBack() {
    if (done) {
      setDone(false);
      setI(AGREEMENT_SECTIONS.length - 1);
      return;
    }
    if (i > 0) setI(i - 1);
  }

  return (
    <div
      className="lk-acct fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "#0A0D12" }}
      data-ack-root
    >
      {/* header + rail */}
      <div className="sticky top-0 z-[5] px-4 pb-3.5 pt-3" style={{ background: "rgba(10,13,18,.94)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--edge2)" }}>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="ack-back"
            style={{ padding: "6px 11px", borderRadius: 9, fontSize: 12.5 }}
            onClick={onBack}
            data-ack-hback
          >
            ‹ Back
          </button>
          <b className="text-[15px] font-bold text-white">Creator agreement</b>
          <span className="ml-auto text-[11px] font-bold tracking-[0.1em] text-[#6E7787]" data-ack-count>
            {done ? "Signed" : section.tag}
          </span>
        </div>
        <div className="rail mt-3.5">
          {railNodes.map((k, idx) => {
            const isDone = signed.includes(k) || done;
            const isNow = idx === i && !done;
            const prevDone = idx > 0 && (signed.includes(railNodes[idx - 1]!) || done);
            return (
              <span key={k} className="contents">
                {idx > 0 && <span className={"link" + (prevDone ? " done" : "")}><i /></span>}
                <span className={"node" + (isDone ? " done" : isNow ? " now" : "")} data-ack-node={k}>
                  {isDone ? "✓" : idx + 1}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* body */}
      <div className="flex flex-col gap-4 px-4 pb-40 pt-4">
        {done ? (
          <div className="text-center">
            <div className="tick">✓</div>
            <h1 className="mb-2">You are cleared to create</h1>
            <p className="sub">
              All three sections signed. You can read them again any time from Settings, and we will ask you to re-sign if they change.
            </p>
            <div className="blk money mt-4 text-left">
              <div className="lb">Your signatures <i></i></div>
              {AGREEMENT_SECTIONS.map((s) => (
                <div key={s.k} className="rec" data-ack-rec={s.k}>
                  <span className="c">✓</span>
                  <span className="n">{s.title}</span>
                  <span className="d">{AGREEMENT_VERSION} · just now</span>
                </div>
              ))}
            </div>
            <p className="esig mt-3 text-center">Draft text — not reviewed by counsel.</p>
          </div>
        ) : (
          <>
            <div>
              <h1>{section.title}</h1>
              <p className="sub">{section.sub}</p>
            </div>

            {section.blocks.map((b, bi) => (
              <div key={bi} className={"blk" + (b.cls ? " " + b.cls : "")}>
                <div className="lb">{b.lb} <i></i></div>
                {b.pts.map((p, pi) => (
                  <div key={pi} className="pt">
                    <span className={"m " + p.marker}>{p.marker === "no" ? "✕" : "✓"}</span>
                    <div dangerouslySetInnerHTML={{ __html: p.html }} />
                  </div>
                ))}
              </div>
            ))}

            <div className="blk act">
              <div className="lb">Sign this section <i></i></div>
              <div
                className={"sign" + (isTicked ? " on" : "")}
                onClick={toggle}
                data-ack-sign
                role="checkbox"
                aria-checked={isTicked}
                tabIndex={0}
              >
                <div className="box">✓</div>
                <div className="tx">{section.sign}</div>
              </div>
              <p className="esig">{ESIG_TEXT}</p>
            </div>

            {error && <p className="text-[13px]" style={{ color: "#FFB3A7" }}>{error}</p>}
          </>
        )}
      </div>

      {/* footer */}
      <div className="ack-ft">
        <div className="ack-ftin">
          <button
            type="button"
            className="ack-back"
            style={{ visibility: i === 0 && !done ? "hidden" : "visible" }}
            onClick={onBack}
          >
            Back
          </button>
          <button
            type="button"
            className="ack-next"
            disabled={!done && (!isTicked || pending)}
            onClick={onContinue}
            data-ack-next
          >
            {done ? "Go to your creator hub" : i === AGREEMENT_SECTIONS.length - 1 ? "Finish" : "Continue"}
          </button>
        </div>
        <div className="ack-hint" data-ack-hint>
          {done || isTicked ? "" : "Tick the box above to continue"}
        </div>
      </div>
    </div>
  );
}
