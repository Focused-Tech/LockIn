/**
 * CHAMPIONSHIP TRIGGER CARDS — pure evaluation. Each card fires ONCE per user, gated by a seen-record
 * exactly like the tutorials once-only precedent. Cards are dismissable and never modal (that's the
 * component's job); this module only decides WHICH single card (if any) is eligible right now.
 *
 *   f1 first_win        — the player's first advanced-slate win
 *   f2 division_change  — the player's division changed (first time it's observed to differ)
 *   f3 season_milestone — armed by an architectSet date; DISARMED (never eligible) while unset
 */

export const TRIGGER_CARD_IDS = ["first_win", "division_change", "season_milestone"] as const;
export type TriggerCardId = (typeof TRIGGER_CARD_IDS)[number];

export interface TriggerState {
  /** The player has at least one advanced-slate win. */
  firstWin: boolean;
  /** The player's division was observed to change. */
  divisionChanged: boolean;
  /** The season milestone date is set AND has passed. False while the date is unset (disarmed). */
  milestoneReached: boolean;
  /** Per-card seen-records (true = already fired for this user). */
  seen: Record<TriggerCardId, boolean>;
}

/**
 * The single card to show now — the highest-priority card whose condition is met AND that hasn't
 * been seen. Returns null when nothing is eligible. Priority: first_win → division_change →
 * season_milestone. Because a seen card is excluded, each fires at most once, ever.
 */
export function evaluateTrigger(state: TriggerState): TriggerCardId | null {
  if (state.firstWin && !state.seen.first_win) return "first_win";
  if (state.divisionChanged && !state.seen.division_change) return "division_change";
  if (state.milestoneReached && !state.seen.season_milestone) return "season_milestone";
  return null;
}

/** Whether the season-milestone is armed and reached, given the placeholder date and "now". */
export function milestoneReached(milestoneIso: string | null, nowMs: number): boolean {
  if (!milestoneIso) return false; // disarmed
  const t = Date.parse(milestoneIso);
  return Number.isFinite(t) && nowMs >= t;
}
