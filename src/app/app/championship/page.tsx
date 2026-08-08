import { redirect } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import {
  CHAMPIONSHIP_SECTIONS,
  CHAMPIONSHIP_SECTION_PENDING,
  type ChampionshipSection,
} from "@/lib/championship/copy";
import { CHAMPIONSHIP_DIVISIONS } from "@/lib/contest/architectSet";
import "../lk-panels.css";

/**
 * CHAMPIONSHIP RULES PAGE — renders the APPROVED copy-slot DATA verbatim. Bold, bullets, and the
 * prize table come straight from the stored strings (no rewording here). The official-rules section
 * ships flagged "pending legal review" (pendingReview). Empty slots fall back to a "copy pending"
 * placeholder. No seat-claim flow — qualification/rules DISPLAY only.
 */
export default async function ChampionshipPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div className="lk-acct flex flex-col gap-4 p-4 pb-24">
      <div className="phd">
        <div className="n">
          <b>The Championship</b>
          <span>How qualifying, seats, and prizes work.</span>
        </div>
      </div>

      {CHAMPIONSHIP_SECTIONS.map((s) => {
        const pending = !s.copy.trim();
        return (
          <div key={s.id} className="blk">
            <div className="lb">
              {s.title} <i></i>
              {s.pendingReview && (
                <span className="modechip coins" style={{ marginLeft: 8 }}>Pending review</span>
              )}
            </div>

            {s.id === "divisions" && (
              <div className="badges" style={{ marginTop: 0, marginBottom: 12 }}>
                {CHAMPIONSHIP_DIVISIONS.map((d) => (
                  <span key={d.tier} className="badge rank">{d.label}</span>
                ))}
              </div>
            )}

            {pending ? (
              <div className="hint" style={{ border: "1px dashed var(--edge)", borderRadius: 12, padding: 13, fontStyle: "italic" }}>
                {CHAMPIONSHIP_SECTION_PENDING}
              </div>
            ) : (
              <SectionCopy section={s} />
            )}
          </div>
        );
      })}

      <SkillGameDisclaimer className="mt-2" />
    </div>
  );
}

/** Inline bold: split on ** and bold the odd segments. */
function inlineBold(text: string): ReactNode {
  return text.split("**").map((seg, i) =>
    i % 2 === 1 ? <b key={i} style={{ color: "#fff" }}>{seg}</b> : <Fragment key={i}>{seg}</Fragment>,
  );
}

/** Render a stored section's copy verbatim: paragraphs, `- ` bullets, and the `|` prize table. */
function SectionCopy({ section }: { section: ChampionshipSection }) {
  const lines = section.copy.split("\n");
  const out: ReactNode[] = [];
  let table: string[][] = [];

  const flushTable = () => {
    if (!table.length) return;
    const rows = table;
    table = [];
    out.push(
      <div key={`t${out.length}`} className="mt-1" style={{ borderTop: "1px solid var(--edge)" }}>
        {rows.map((cells, i) => (
          <div key={i} className="row static" style={{ padding: "9px 0" }}>
            <span className="n"><b style={{ fontWeight: 600 }}>{inlineBold(cells[0] ?? "")}</b></span>
            <span className="val">{inlineBold(cells[1] ?? "")}</span>
          </div>
        ))}
      </div>,
    );
  };

  const bullets: ReactNode[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    out.push(
      <ul key={`u${out.length}`} style={{ margin: "4px 0", paddingLeft: 18, listStyle: "disc" }}>
        {bullets.map((b, i) => <li key={i} className="hint" style={{ marginBottom: 6 }}>{b}</li>)}
      </ul>,
    );
    bullets.length = 0;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|/.test(line)) {
      flushBullets();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue; // separator row
      table.push(cells);
      continue;
    }
    flushTable();
    if (/^-\s+/.test(line)) {
      bullets.push(inlineBold(line.replace(/^-\s+/, "")));
      continue;
    }
    flushBullets();
    if (!line.trim()) continue;
    out.push(<p key={`p${out.length}`} className="hint" style={{ margin: "6px 0", lineHeight: 1.5 }}>{inlineBold(line)}</p>);
  }
  flushTable();
  flushBullets();
  return <>{out}</>;
}
