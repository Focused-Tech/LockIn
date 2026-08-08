"use client";

import { useState } from "react";
import Link from "next/link";
import { CHAMPIONSHIP_CARDS, CHAMPIONSHIP_CARD_PENDING } from "@/lib/championship/copy";
import { markChampionshipCardSeen } from "./actions";
import type { TriggerCardId } from "@/lib/championship/triggers";

/**
 * CHAMPIONSHIP TRIGGER CARD — dismissable, NEVER modal. Renders the single eligible card (decided
 * server-side, once-only). Card copy is a pending DATA slot, so the body shows the "copy pending"
 * placeholder — no invented copy. Dismiss writes the once-only seen-record so it never fires again.
 */
export function ChampionshipTriggers({
  card,
  currentDivision,
}: {
  card: TriggerCardId;
  currentDivision: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const copy = CHAMPIONSHIP_CARDS[card];
  const title = copy?.title.trim() || "Championship";
  const body = copy?.body.trim() || CHAMPIONSHIP_CARD_PENDING;

  function dismiss() {
    setDismissed(true); // optimistic — never trap the player
    void markChampionshipCardSeen(card, currentDivision).catch(() => {});
  }

  return (
    <div className="blk act" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "none",
          border: "none",
          color: "var(--dim2)",
          fontSize: 18,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      <div className="lb">{title} <i></i></div>
      <p
        className="hint"
        style={{
          border: "1px dashed var(--edge)",
          borderRadius: 12,
          padding: "13px",
          fontStyle: !copy?.body.trim() ? "italic" : "normal",
        }}
      >
        {body}
      </p>
      <div className="btns">
        <Link href="/app/championship" className="btn pri" style={{ textAlign: "center", textDecoration: "none" }}>
          See the Championship
        </Link>
      </div>
    </div>
  );
}
