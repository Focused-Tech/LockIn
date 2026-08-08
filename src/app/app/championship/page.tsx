import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/firebase/session";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import {
  CHAMPIONSHIP_SECTIONS,
  CHAMPIONSHIP_SECTION_PENDING,
} from "@/lib/championship/copy";
import { CHAMPIONSHIP_DIVISIONS } from "@/lib/contest/architectSet";
import "../lk-panels.css";

/**
 * CHAMPIONSHIP RULES PAGE — sections render from the copy-slot DATA store. Prose is PENDING (empty),
 * so each section shows an honest "copy pending" placeholder rather than invented copy. The only
 * concrete structure shown is the division tiers ($5/$10/$25/$50), which are architect-given. No
 * seat-claim flow exists here — this is qualification/rules DISPLAY only.
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
            <div className="lb">{s.title} <i></i></div>

            {s.id === "divisions" && (
              <div className="badges" style={{ marginTop: 0, marginBottom: pending ? 12 : 0 }}>
                {CHAMPIONSHIP_DIVISIONS.map((d) => (
                  <span key={d.tier} className="badge rank">{d.label}</span>
                ))}
              </div>
            )}

            {pending ? (
              <div
                className="hint"
                style={{
                  border: "1px dashed var(--edge)",
                  borderRadius: 12,
                  padding: "13px",
                  color: "var(--dim2)",
                  fontStyle: "italic",
                }}
              >
                {CHAMPIONSHIP_SECTION_PENDING}
              </div>
            ) : (
              <p className="hint" style={{ whiteSpace: "pre-wrap" }}>{s.copy}</p>
            )}
          </div>
        );
      })}

      <SkillGameDisclaimer className="mt-2" />
    </div>
  );
}
