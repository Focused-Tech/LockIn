"use client";

/**
 * CREATOR SUGGESTION QUEUE (E) — the reconstructed follower proposals for this slate. Each is a
 * compliant PROPOSAL in the approved voice, mapped to an archetype; the creator accepts (keeps it to
 * build + publish) or dismisses. A follower never publishes — accepting still routes through the
 * builder's validateLeg when the creator authors the leg.
 */
import { useState, useTransition } from "react";
import { resolveSuggestion } from "@/app/app/slate/[id]/suggest-actions";
import type { SuggestionView } from "@/server/data/suggestions";

const ARCH_LABEL: Record<string, string> = {
  cross_game_h2h: "Head-to-head",
  field_leader: "Field leader",
  biggest_night: "Biggest night",
  split_squad_duos: "Split-squad duos",
  milestone_count: "Milestone count",
  first_to_n: "First to N",
};

export function SuggestionQueue({ slateId, items }: { slateId: string; items: SuggestionView[] }) {
  const [rows, setRows] = useState(items);
  const [pending, start] = useTransition();
  const [accepted, setAccepted] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const act = (id: string, action: "accept" | "dismiss") =>
    start(async () => {
      const r = await resolveSuggestion(slateId, id, action);
      if (r.ok) {
        setRows((rs) => rs.filter((x) => x.id !== id));
        if (action === "accept") setAccepted(id);
      }
    });

  return (
    <div className="flex flex-col gap-2 rounded border border-[#1E2A38] bg-[#12161E] px-4 py-3">
      <p className="text-sm font-semibold">
        Fan suggestions <span className="text-muted">· {rows.length}</span>
      </p>
      <p className="text-xs text-muted">
        The Locksmith rewrote these into allowed questions. Accept to add one to your list, then publish
        it from the builder — nothing goes live without you.
      </p>
      {rows.map((s) => (
        <div key={s.id} className="flex flex-col gap-1.5 rounded border border-[#1E2A38] bg-[#0D1118] px-3 py-2.5">
          <p className="text-sm font-medium text-[#E8ECF2]">“{s.reconstructedQuestion}”</p>
          <p className="text-xs text-muted">
            {ARCH_LABEL[s.archetype] ?? s.archetype} · suggested by @{s.suggestedByUsername}
          </p>
          <p className="text-[11px] text-muted">Their idea: “{s.rawText}”</p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(s.id, "accept")}
              className="rounded bg-[rgba(34,197,94,.14)] px-3 py-1 text-xs font-semibold text-[#22C55E] disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(s.id, "dismiss")}
              className="rounded px-3 py-1 text-xs font-medium text-muted disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {accepted && (
        <p className="text-xs text-[#22C55E]">Added to your list — open the builder to publish it.</p>
      )}
    </div>
  );
}
