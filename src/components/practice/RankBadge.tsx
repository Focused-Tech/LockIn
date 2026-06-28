import type { PracticeTierKey } from "@/lib/practice/tiers";

const TIER_STYLE: Record<PracticeTierKey, string> = {
  rookie: "border-border bg-surface-card text-muted",
  sharp: "border-ai/40 bg-[rgba(59,139,255,0.10)] text-ai",
  pro: "border-win-border bg-win-soft text-win",
  elite: "border-rush-border bg-rush-soft text-rush",
  legend: "border-accent-border bg-accent-soft text-accent",
};

/** Earned practice-rank title chip. Status only — never purchasable. */
export function RankBadge({
  tier,
  label,
  className = "",
}: {
  tier: PracticeTierKey;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide " +
        TIER_STYLE[tier] +
        " " +
        className
      }
    >
      {label}
    </span>
  );
}
