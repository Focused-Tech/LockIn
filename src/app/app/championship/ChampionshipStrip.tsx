"use client";

import Link from "next/link";
import { winRateLabel, qualificationLineLabel, standingLabel } from "@/lib/championship/strip";
import type { ChampionshipStrip as StripData } from "@/server/data/championship";

/**
 * CHAMPIONSHIP BOARD STRIP — advanced Board only. Shows the player's division, season win rate, and
 * standing vs the qualification line. Tapping opens /app/championship. While QUALIFICATION_LINE is
 * unset the line + standing read "—" — never a placeholder number.
 */
export function ChampionshipStrip({ data }: { data: StripData }) {
  return (
    <Link href="/app/championship" className="blk act" style={{ textDecoration: "none", display: "block" }}>
      <div className="lb">Championship <i></i></div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="stat">
          <div className="k">Division</div>
          <div className="v">{data.division}</div>
        </div>
        <div className="stat">
          <div className="k">Win rate</div>
          <div className="v">{winRateLabel(data.winRatePct)}</div>
        </div>
        <div className="stat">
          <div className="k">Line</div>
          <div className="v">{qualificationLineLabel(data.qualificationLine)}</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        {standingLabel(data.winRatePct, data.qualificationLine)} · Tap for the Championship rules ›
      </p>
    </Link>
  );
}
