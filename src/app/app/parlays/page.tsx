import { redirect } from "next/navigation";
import { SkillGameDisclaimer } from "@/components/SkillGameDisclaimer";
import { Card, Pill } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUserId } from "@/lib/firebase/session";
import { fetchUserParlays, type ParlayView } from "@/server/data/parlays";
import { formatCents } from "@/lib/utils";

const STATUS_LABEL: Record<ParlayView["status"], string> = {
  open: "In progress",
  ready: "Grading",
  settled: "Settled",
  refunded: "Refunded",
};

function statusTone(status: ParlayView["status"]) {
  if (status === "settled") return "win" as const;
  if (status === "refunded") return "neutral" as const;
  if (status === "open") return "live" as const;
  return "accent" as const;
}

const PICK_MARK: Record<string, string> = {
  correct: "✓",
  incorrect: "✗",
  void: "—",
  pending: "·",
};

export default async function ParlaysPage() {
  const uid = await getCurrentUserId();
  if (!uid) redirect("/login");

  const parlays = await fetchUserParlays(adminDb(), uid);

  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Your parlays</h1>
        <p className="text-sm text-muted">
          Cross-slate entries settle once every included contest is final.
        </p>
      </div>

      {parlays.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">No parlays yet.</p>
          <p className="text-xs text-muted">
            Open a contest, tap &ldquo;add to parlay&rdquo; on questions across
            events, then submit from the ⚡ button.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {parlays.map((p) => {
            const won =
              (p.payoutCents ?? 0) > 0 || (p.payoutCoins ?? 0) > 0;
            const prize =
              p.status !== "settled" && p.status !== "refunded"
                ? null
                : p.refunded
                  ? "Refunded"
                  : (p.payoutCents ?? 0) > 0
                    ? `Won ${formatCents(p.payoutCents!)}`
                    : (p.payoutCoins ?? 0) > 0
                      ? `Won ${p.payoutCoins} coins`
                      : "No prize";

            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill tone={statusTone(p.status)}>
                        {STATUS_LABEL[p.status]}
                      </Pill>
                      <span className="text-xs text-muted">
                        {p.isPaid ? `$${p.entryTier}` : "Free"} ·{" "}
                        {p.parlayMultiplier}× · {p.picks.length} picks
                      </span>
                    </div>
                    {prize && (
                      <span
                        className={
                          "text-sm font-semibold " +
                          (won ? "text-win" : "text-muted")
                        }
                      >
                        {prize}
                      </span>
                    )}
                  </div>

                  {p.status === "settled" && p.totalScore !== null && (
                    <p className="text-xs text-muted">
                      Score {p.totalScore}
                      {p.rank ? ` · Rank #${p.rank}` : ""}
                    </p>
                  )}
                  {p.status === "open" && (
                    <p className="text-xs text-muted">
                      {p.resolvedCount}/{p.picks.length} contests final
                    </p>
                  )}

                  <ul className="flex flex-col gap-1.5 border-t border-border pt-2">
                    {p.picks.map((pk, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="truncate text-xs text-muted">
                            {pk.slateTitle}
                          </span>
                          <span className="block truncate">
                            {pk.question} —{" "}
                            <span className="text-accent">{pk.pickLabel}</span>
                          </span>
                        </span>
                        <span
                          className={
                            "shrink-0 " +
                            (pk.status === "correct"
                              ? "text-win"
                              : pk.status === "incorrect"
                                ? "text-loss"
                                : "text-muted")
                          }
                        >
                          {PICK_MARK[pk.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <SkillGameDisclaimer className="mt-auto pt-4" />
    </div>
  );
}
