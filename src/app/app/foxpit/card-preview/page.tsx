"use client";

import { useState } from "react";
import { SlateCardFront, type SlateMatchup } from "@/components/foxpit/SlateCardFront";

/**
 * Fox Pit CARD FRONT preview — a review surface for the code-built slate card
 * front (STEP 3a). Sample data only; toggle the reveal to see the per-row
 * resolve (green check / red ✗). Not a production route — for device review.
 */
// COMPLIANCE — compliant cross-game archetypes only (no team outcomes, spreads, over/unders, or
// single-athlete thresholds). This is card-art preview mock data, not a real slate.
const MATCHUPS: SlateMatchup[] = [
  { id: "m1", question: "Top scorer tonight", optionA: "LeBron James", optionB: "Nikola Jokić" },
  { id: "m2", question: "Most assists across the slate", optionA: "Trae Young", optionB: "Chris Paul" },
  { id: "m3", question: "Best QB night", optionA: "Mahomes", optionB: "Allen" },
  { id: "m4", question: "Biggest night", optionA: "Curry", optionB: "Dončić" },
  { id: "m5", question: "Player of the night", optionA: "Jokić", optionB: "SGA" },
];

const PICKS = { m1: "a", m2: "a", m3: "b", m4: "a", m5: "b" } as const;
const RESULTS = { m1: "a", m2: "b", m3: "b", m4: "a", m5: "a" } as const;

export default function CardPreviewPage() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-background px-4 py-10">
      <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-muted">
        Slate card front · 3a preview
      </h1>

      <div className="flex flex-wrap items-start justify-center gap-6">
        {/* blank front */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">Blank</span>
          <SlateCardFront slateNumber={128} matchups={MATCHUPS} />
        </div>

        {/* played + reveal */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted">
            {revealed ? "Revealed" : "Locked in"}
          </span>
          <SlateCardFront
            slateNumber={128}
            matchups={MATCHUPS}
            picks={PICKS}
            results={RESULTS}
            revealed={revealed}
          />
        </div>
      </div>

      <button
        onClick={() => setRevealed((r) => !r)}
        className="rounded-xl border border-accent/50 bg-accent/10 px-6 py-3 text-sm font-bold text-accent active:scale-95"
      >
        {revealed ? "Reset" : "Reveal outcomes"}
      </button>
    </div>
  );
}
