"use client";

import { computeSlateMetrics } from "@/lib/contest";
import { catColors } from "@/lib/categoryColors";
import { FREE_ENTRY_COIN_COST, type EntryTier } from "@/lib/constants";
import type { FeedSlate } from "@/lib/feed";
import { formatCentsShort, formatMultiple } from "@/lib/utils";
import "./floor-card.css";

function tierConfig(slate: FeedSlate, selected: EntryTier) {
  return (
    slate.entryTiers.find((t) => t.tier === selected) ??
    [...slate.entryTiers].sort((a, b) => a.tier - b.tier)[0]
  );
}

/**
 * THE FLOOR contest card (explore.html). Category-coloured 4px left edge so the feed reads
 * by colour before a word. COIN contests never render a dollar figure — the coin pool, first
 * place and entry are all coins.
 */
export function FloorCard({
  slate,
  tier,
  currency,
}: {
  slate: FeedSlate;
  tier: EntryTier;
  currency: "cash" | "coins";
}) {
  const [cat, catd] = catColors(slate.category);
  const demo = slate.isDemo === true;
  const coin = currency === "coins";
  const locked = slate.status === "locked";
  const legs = slate.predictions.length;
  const initial = (slate.creatorName ?? "L").charAt(0).toUpperCase();

  const config = tierConfig(slate, tier);
  const metrics = config
    ? computeSlateMetrics(config.tier, config.hostingFeeCents, slate.entryCount, slate.rushMultiplier)
    : null;

  // COIN pool is a coin count (free pools take zero rake); CASH pool is $ from the metrics.
  const coinPool = slate.entryCount * FREE_ENTRY_COIN_COST;
  const coinFirst = Math.round(coinPool * 0.12);
  const poolLabel = coin ? `${coinPool.toLocaleString()} coins` : metrics ? formatCentsShort(metrics.prizePoolCents) : "—";
  const firstLabel = coin ? coinFirst.toLocaleString() : metrics ? formatCentsShort(metrics.firstPlaceCents) : "—";
  const multLabel = coin
    ? `${(coinFirst / FREE_ENTRY_COIN_COST).toFixed(1)}×`
    : metrics ? formatMultiple(metrics.firstPlaceMultiple) : "";
  const entryLabel = demo
    ? "Demo · free to play"
    : coin
      ? `Coin entry · ${FREE_ENTRY_COIN_COST}`
      : `Cash entry · $${config?.tier ?? tier}`;

  return (
    <div className="fc-card" style={{ "--fc-cat": cat, "--fc-catd": catd } as React.CSSProperties}>
      <div className="fc-top">
        <span className="fc-cat">{slate.category}</span>
        <span className={"fc-st " + (demo ? "live" : locked ? "lock" : "live")}>{demo ? "Demo" : locked ? "Locked" : "Live"}</span>
      </div>
      <h3 className="fc-title">{slate.title}</h3>
      <div className="fc-by">
        {slate.creatorName && <span className="av">{initial}</span>}
        {slate.creatorName ? `@${slate.creatorName}` : "Hosted on LockIn"}
        <span style={{ color: "#39424f" }}>·</span> {legs} leg{legs === 1 ? "" : "s"}
      </div>
      <div className="fc-pool">
        <div>
          <span className="k">Prize pool</span>
          <span className={"v" + (coin ? " coin" : "")}>{poolLabel}</span>
        </div>
        <div>
          <span className="k">1st place</span>
          <span className="v w">
            {firstLabel}
            {multLabel && <small>{multLabel}</small>}
          </span>
        </div>
        <div className="rt">
          {slate.entryCount.toLocaleString()}
          <b>in</b>
        </div>
      </div>
      <div className="fc-entry">
        <span className={"tag " + (coin ? "coin" : "cash")}>{entryLabel}</span>
        <span className="rt">Tap to open ›</span>
      </div>
    </div>
  );
}
