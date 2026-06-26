import { Card } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryStat } from "@/lib/ai/chat";
import { formatCents } from "@/lib/utils";

const ICON_BY_CATEGORY = new Map(CATEGORIES.map((c) => [c.name, c.icon]));

/**
 * Pro-only panel: the player's settled-contest record broken down by category.
 * Server component — receives the rolled-up stats from the page.
 */
export function CategoryPerformance({ stats }: { stats: CategoryStat[] }) {
  return (
    <Card className="flex flex-col gap-3 border-ai/30">
      <p className="text-sm font-semibold text-ai">Your category performance</p>

      {stats.length === 0 ? (
        <p className="text-sm text-muted">
          Play a few contests and your win rate by category will show up here —
          the Strategy Advisor uses it to tailor your edge.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.map((s) => (
            <li
              key={s.category}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{ICON_BY_CATEGORY.get(s.category) ?? "•"}</span>
                <span className="text-foreground">{s.category}</span>
                <span className="text-muted">
                  · {s.plays} played
                  {s.totalWonCents > 0 && ` · ${formatCents(s.totalWonCents)} won`}
                </span>
              </span>
              <span
                className={s.winRatePct >= 50 ? "text-win" : "text-muted"}
              >
                {s.winRatePct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
