import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type EntryDoc } from "@/lib/firebase/types";
import { QUALIFICATION_LINE, CHAMPIONSHIP_SEASON_MILESTONE } from "@/lib/contest/architectSet";
import { divisionLabelForTiers } from "@/lib/championship/strip";
import {
  milestoneReached,
  type TriggerState,
  type TriggerCardId,
} from "@/lib/championship/triggers";

/**
 * CHAMPIONSHIP server data — the Board strip + the trigger-card state. Reads ONLY the player's own
 * settled entries (a userId-filtered collection-group query) and their once-only seen-records. No
 * house-margin data. QUALIFICATION_LINE stays null (→ "—") until the architect sets it.
 */

export interface ChampionshipStrip {
  /** Division label from the player's top paid tier, or "—". */
  division: string;
  /** Season win rate (0–100), or null when no settled plays. */
  winRatePct: number | null;
  /** The qualification line (win-rate %), or null while unset. */
  qualificationLine: number | null;
}

/** The player's division + season win rate, computed from their settled paid entries. */
async function readSeasonStats(db: Firestore, uid: string): Promise<{ division: string; winRatePct: number | null }> {
  const snap = await db.collectionGroup(COLLECTIONS.entries).where("userId", "==", uid).get();
  const tiers: number[] = [];
  let plays = 0;
  let wins = 0;
  for (const d of snap.docs) {
    const e = d.data() as EntryDoc;
    if (!e.isPaid || e.rank == null) continue; // settled paid entries only (rank set at settlement)
    plays += 1;
    tiers.push(e.entryTier);
    if (!e.refunded && (e.payoutCents ?? 0) > 0) wins += 1;
  }
  return {
    division: divisionLabelForTiers(tiers),
    winRatePct: plays > 0 ? (wins / plays) * 100 : null,
  };
}

export async function fetchChampionshipStrip(db: Firestore, uid: string): Promise<ChampionshipStrip> {
  const { division, winRatePct } = await readSeasonStats(db, uid);
  return { division, winRatePct, qualificationLine: QUALIFICATION_LINE };
}

export interface TriggerFetch {
  card: TriggerCardId | null;
  state: TriggerState;
  /** Current division — passed back so a division_change dismissal can record it. */
  currentDivision: string;
}

/**
 * Compute the trigger-card state. Detects a division change by comparing the player's current
 * division to the last one recorded in their seen-store; first observation is recorded (no card).
 * The recorded division is advanced only when the change card is dismissed (see the action), so the
 * card persists until acknowledged. `evaluateTrigger` (pure) picks the single eligible card.
 */
export async function fetchChampionshipTriggerState(db: Firestore, uid: string): Promise<TriggerFetch> {
  const cardsCol = db.collection(COLLECTIONS.users).doc(uid).collection(COLLECTIONS.championshipCards);
  const [{ division, winRatePct }, firstWinSeen, divChangeSeen, milestoneSeen, divisionStateSnap] = await Promise.all([
    readSeasonStats(db, uid),
    cardsCol.doc("first_win").get(),
    cardsCol.doc("division_change").get(),
    cardsCol.doc("season_milestone").get(),
    cardsCol.doc("_division_state").get(),
  ]);

  const prevDivision = divisionStateSnap.exists ? (divisionStateSnap.data() as { division?: string }).division : undefined;
  let divisionChanged = false;
  if (prevDivision === undefined) {
    // First observation — record it, fire nothing.
    if (division !== "—") await cardsCol.doc("_division_state").set({ division }).catch(() => {});
  } else if (prevDivision !== division && division !== "—") {
    divisionChanged = true;
  }

  // firstWin: at least one settled paid win → win rate implies wins, but derive directly.
  const firstWin = winRatePct != null && winRatePct > 0;

  const state: TriggerState = {
    firstWin,
    divisionChanged,
    milestoneReached: milestoneReached(CHAMPIONSHIP_SEASON_MILESTONE, seasonNowMs()),
    seen: {
      first_win: firstWinSeen.exists,
      division_change: divChangeSeen.exists,
      season_milestone: milestoneSeen.exists,
    },
  };

  // evaluateTrigger is imported by the caller for testability; recompute here to return the card.
  const card = state.firstWin && !state.seen.first_win
    ? "first_win"
    : state.divisionChanged && !state.seen.division_change
      ? "division_change"
      : state.milestoneReached && !state.seen.season_milestone
        ? "season_milestone"
        : null;

  return { card, state, currentDivision: division };
}

/** Server "now" in ms (kept in one place so it's easy to see this is not a workflow-script context). */
function seasonNowMs(): number {
  return Date.now();
}

/** Advance the recorded division (used by the division_change dismissal). */
export async function recordDivisionAck(db: Firestore, uid: string, division: string): Promise<void> {
  await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.championshipCards)
    .doc("_division_state")
    .set({ division }, { merge: true });
}
