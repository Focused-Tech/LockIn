import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type UserDoc,
  type KeyholderEventDoc,
} from "@/lib/firebase/types";
import { triggerBand } from "@/lib/keyholder/projection";

/**
 * KEYHOLDER PIPELINE — the work surface (Parts 4–5). Derives each referred creator's STAGE from data
 * that already exists (or renders "—" where a stage's data doesn't exist yet), plus player counts,
 * projected earnings grouped by trigger band, and the upline. Pay triggers on participation, not on
 * signatures — so this shows WHO is stuck and WHERE.
 */

export type CreatorStage = "invited" | "signed_up" | "agreement" | "published" | "settled" | "participating";

const STAGE_LABEL: Record<CreatorStage, string> = {
  invited: "Invited",
  signed_up: "Signed up",
  agreement: "Agreement signed",
  published: "First slate published",
  settled: "First slate settled",
  participating: "Participating",
};

export interface CreatorPipelineRow {
  uid: string;
  username: string;
  stage: CreatorStage;
  stageLabel: string;
  /** ms stuck at the current stage, or null when that stage has no timestamp data ("—"). */
  stuckMs: number | null;
  /** latest participation %, or null (no social connect / not settled) → "—". */
  participationPct: number | null;
}

export interface KeyholderPipeline {
  code: string;
  creators: CreatorPipelineRow[];
  players: { referred: number; deposited: number | null; qualified: number; pending: number };
  earningsByBand: { band: string; creators: number; projectedCents: number | null }[];
  keymasterUsername: string | null;
}

function millis(v: unknown): number {
  return (v as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

export async function fetchKeyholderPipeline(db: Firestore, khUid: string): Promise<KeyholderPipeline> {
  const [userSnap, referredSnap, eventsSnap] = await Promise.all([
    db.collection(COLLECTIONS.users).doc(khUid).get(),
    db.collection(COLLECTIONS.users).where("keyholderUid", "==", khUid).get(),
    db.collection(COLLECTIONS.keyholderEvents).where("keyholderUid", "==", khUid).get(),
  ]);
  const me = userSnap.data() as UserDoc | undefined;

  // Events indexed by referred creator.
  const events = eventsSnap.docs.map((d) => d.data() as KeyholderEventDoc);
  const activated = new Set(events.filter((e) => e.type === "creator_activated").map((e) => e.referredUid));
  const activatedAt = new Map(events.filter((e) => e.type === "creator_activated").map((e) => [e.referredUid, millis(e.createdAt)]));
  const settledByCreator = new Map<string, KeyholderEventDoc[]>();
  for (const e of events) {
    if (e.type === "creator_event_settled") {
      const list = settledByCreator.get(e.referredUid) ?? [];
      list.push(e);
      settledByCreator.set(e.referredUid, list);
    }
  }
  const qualifiedPlayers = new Set(events.filter((e) => e.type === "player_qualified").map((e) => e.referredUid));

  const referred = referredSnap.docs.map((d) => ({ id: d.id, u: d.data() as UserDoc }));
  const isCreator = (id: string, u: UserDoc) => u.creatorVerified || u.isCreator || activated.has(id);
  const creatorSet = referred.filter(({ id, u }) => isCreator(id, u));
  const playerDocs = referred.filter(({ id, u }) => !isCreator(id, u));

  // One slate probe per creator (does the creator have a published slate + when).
  const creators: CreatorPipelineRow[] = await Promise.all(
    creatorSet.map(async ({ id, u }) => {
      const settledEvents = (settledByCreator.get(id) ?? []).slice().sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
      const latestPct = settledEvents.find((e) => e.participationPct != null)?.participationPct ?? null;

      let slateAtMs: number | null = null;
      // Only probe for a slate when we haven't already learned they settled (an activated creator
      // has certainly published). Keeps reads down.
      if (!activated.has(id)) {
        const slateSnap = await db.collection(COLLECTIONS.slates).where("creatorId", "==", id).orderBy("createdAt", "asc").limit(1).get();
        slateAtMs = slateSnap.empty ? null : millis(slateSnap.docs[0]!.data().createdAt);
      }

      let stage: CreatorStage;
      let stuckMs: number | null;
      const now = Date.now();
      if (settledEvents.length > 0 && latestPct != null) {
        stage = "participating";
        stuckMs = now - millis(settledEvents[0]!.createdAt);
      } else if (activated.has(id)) {
        stage = "settled";
        stuckMs = now - (activatedAt.get(id) ?? now);
      } else if (slateAtMs != null) {
        stage = "published";
        stuckMs = now - slateAtMs;
      } else if (u.creatorOnboarded === true) {
        stage = "agreement";
        stuckMs = null; // no signature timestamp on the profile → "—"
      } else {
        stage = "signed_up";
        stuckMs = u.createdAt ? now - millis(u.createdAt) : null;
      }

      return { uid: id, username: u.username, stage, stageLabel: STAGE_LABEL[stage], stuckMs, participationPct: latestPct };
    }),
  );
  creators.sort((a, b) => (b.stuckMs ?? 0) - (a.stuckMs ?? 0));

  // Players — deposited via a bounded per-player probe (small trees). "—" would apply at scale.
  const deposited = await Promise.all(
    playerDocs.map(async ({ id }) => {
      const dep = await db.collection(COLLECTIONS.deposits).where("userId", "==", id).where("status", "==", "succeeded").limit(1).get();
      return dep.empty ? 0 : 1;
    }),
  );
  const depositedCount = deposited.reduce<number>((n, x) => n + x, 0);
  const qualifiedCount = playerDocs.filter(({ id }) => qualifiedPlayers.has(id)).length;

  // Earnings grouped by trigger band (projected only; "—" while rates unset).
  const bandBuckets = new Map<string, number>();
  for (const c of creators) {
    const band = triggerBand(c.participationPct);
    const label = band ? `Band ≥ ${(band.minParticipationPct * 100).toFixed(0)}%` : "Unbanded";
    bandBuckets.set(label, (bandBuckets.get(label) ?? 0) + 1);
  }
  const earningsByBand = [...bandBuckets.entries()].map(([band, count]) => ({ band, creators: count, projectedCents: null }));

  // Upline keymaster username.
  let keymasterUsername: string | null = null;
  if (me?.keymasterUid) {
    const kmSnap = await db.collection(COLLECTIONS.users).doc(me.keymasterUid).get();
    keymasterUsername = (kmSnap.data() as UserDoc | undefined)?.username ?? null;
  }

  return {
    code: me?.username ?? "",
    creators,
    players: { referred: playerDocs.length, deposited: depositedCount, qualified: qualifiedCount, pending: playerDocs.length - qualifiedCount },
    earningsByBand,
    keymasterUsername,
  };
}
