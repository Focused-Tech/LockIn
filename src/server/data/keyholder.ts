import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type UserDoc,
  type KeyholderReferralDoc,
  type KeyholderEventDoc,
} from "@/lib/firebase/types";
import { DIVISION_FOLLOWERS, type Division } from "@/lib/contest/architectSet";
import {
  projectKeyholderEarnings,
  triggerBandStatus,
  type ProjectionInputs,
} from "@/lib/keyholder/projection";

/**
 * KEYHOLDER PORTAL data — a keyholder sees ONLY their own referrals' performance and their own
 * PROJECTED earnings. This DTO deliberately carries NO pool rake, NO creator-cut split, and NO
 * LockIn fee net (the privacy line). Gross host fees live in the ledger for server-side projection
 * but are never returned here.
 */

export interface KeyholderCreatorRow {
  uid: string;
  username: string;
  /** Division badge derived from verified reach; "—" when there is no social connect. */
  division: string;
  eventsSettled: number;
  totalEntries: number;
  /** null → render "—", never 0 (no social connect). */
  latestParticipationPct: number | null;
  bandStatus: string;
}

export interface KeyholderEarnings {
  armed: boolean;
  creatorProjectedCents: number | null;
  playerProjectedCents: number | null;
  totalProjectedCents: number | null;
  qualifiedPlayers: number;
}

export interface KeymasterRow {
  uid: string;
  username: string;
  creators: number;
  players: number;
  totalEntries: number;
  totalProjectedCents: number | null;
}

export interface KeyholderPortalData {
  code: string; // = username (shared with the existing referral rail)
  isKeymaster: boolean;
  counts: { creators: number; players: number; pending: number; total: number };
  creators: KeyholderCreatorRow[];
  earnings: KeyholderEarnings;
  keymaster?: {
    keyholders: KeymasterRow[];
    rollup: { creators: number; players: number; totalEntries: number; totalProjectedCents: number | null };
  };
}

/** Reach → division badge. Highest division whose follower midpoint the reach meets. */
function deriveDivision(followers: number | null | undefined): string {
  if (followers == null) return "—";
  const order: Division[] = ["boss", "shark", "wolf", "hawk"];
  for (const d of order) if (followers >= DIVISION_FOLLOWERS[d]) return d.charAt(0).toUpperCase() + d.slice(1);
  return "Hawk";
}

function millis(v: unknown): number {
  const t = v as { toMillis?: () => number } | undefined;
  return t?.toMillis?.() ?? 0;
}

interface Aggregate {
  creators: number;
  players: number;
  pending: number;
  total: number;
  qualifiedPlayers: number;
  totalEntries: number;
  projectionInputs: ProjectionInputs;
  /** creatorUid → its events, for building creator rows. */
  byCreator: Map<string, KeyholderEventDoc[]>;
}

/** Pull one keyholder's referral + event aggregates (shared by the keyholder view and the roll-up). */
async function aggregateForKeyholder(db: Firestore, keyholderUid: string): Promise<Aggregate> {
  const [refsSnap, eventsSnap] = await Promise.all([
    db.collection(COLLECTIONS.keyholderReferrals).where("keyholderUid", "==", keyholderUid).get(),
    db.collection(COLLECTIONS.keyholderEvents).where("keyholderUid", "==", keyholderUid).get(),
  ]);

  const refs = refsSnap.docs.map((d) => d.data() as KeyholderReferralDoc);
  const creators = refs.filter((r) => r.type === "creator").length;
  const players = refs.filter((r) => r.type === "player").length;
  const total = refs.length;

  const events = eventsSnap.docs.map((d) => d.data() as KeyholderEventDoc);
  const qualifiedPlayers = events.filter((e) => e.type === "player_qualified").length;

  const byCreator = new Map<string, KeyholderEventDoc[]>();
  const creatorEvents: ProjectionInputs["creatorEvents"] = [];
  let totalEntries = 0;
  for (const e of events) {
    if (e.type === "creator_activated" || e.type === "creator_event_settled") {
      const list = byCreator.get(e.referredUid) ?? [];
      list.push(e);
      byCreator.set(e.referredUid, list);
      totalEntries += e.entries ?? 0;
      creatorEvents.push({ entries: e.entries ?? 0, participationPct: e.participationPct });
    }
  }

  return {
    creators,
    players,
    pending: total - creators - players,
    total,
    qualifiedPlayers,
    totalEntries,
    projectionInputs: { creatorEvents, qualifiedPlayers },
    byCreator,
  };
}

export async function fetchKeyholderPortal(db: Firestore, uid: string): Promise<KeyholderPortalData> {
  const userSnap = await db.collection(COLLECTIONS.users).doc(uid).get();
  const user = userSnap.data() as UserDoc | undefined;

  const agg = await aggregateForKeyholder(db, uid);

  // Build the "My creators" rows — one per referred creator, newest activity first.
  const creatorUids = [...agg.byCreator.keys()];
  const creatorUserSnaps = await Promise.all(
    creatorUids.map((cu) => db.collection(COLLECTIONS.users).doc(cu).get()),
  );
  const creatorUserById = new Map<string, UserDoc | undefined>();
  creatorUserSnaps.forEach((snap, i) => {
    const cu = creatorUids[i];
    if (cu) creatorUserById.set(cu, snap.data() as UserDoc | undefined);
  });

  const creators: KeyholderCreatorRow[] = creatorUids.map((cu) => {
    const evs = [...(agg.byCreator.get(cu) ?? [])].sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
    const cUser = creatorUserById.get(cu);
    const latestWithPct = evs.find((e) => e.participationPct != null);
    const totalEntries = evs.reduce((n, e) => n + (e.entries ?? 0), 0);
    const pct = latestWithPct?.participationPct ?? null;
    return {
      uid: cu,
      username: cUser?.username ?? "creator",
      division: deriveDivision(cUser?.verifiedFollowers),
      eventsSettled: evs.length,
      totalEntries,
      latestParticipationPct: pct,
      bandStatus: triggerBandStatus(pct),
    };
  });
  creators.sort((a, b) => b.eventsSettled - a.eventsSettled || b.totalEntries - a.totalEntries);

  const proj = projectKeyholderEarnings(agg.projectionInputs);

  const data: KeyholderPortalData = {
    code: user?.username ?? "",
    isKeymaster: user?.keymaster === true,
    counts: { creators: agg.creators, players: agg.players, pending: agg.pending, total: agg.total },
    creators,
    earnings: {
      armed: proj.armed,
      creatorProjectedCents: proj.creatorProjectedCents,
      playerProjectedCents: proj.playerProjectedCents,
      totalProjectedCents: proj.totalProjectedCents,
      qualifiedPlayers: agg.qualifiedPlayers,
    },
  };

  // KEYMASTER roll-up — the downline keyholders under this keymaster + the same metrics summed.
  if (user?.keymaster === true) {
    const downSnap = await db.collection(COLLECTIONS.users).where("keymasterUid", "==", uid).get();
    const rows: KeymasterRow[] = [];
    for (const d of downSnap.docs) {
      const kh = d.data() as UserDoc;
      const a = await aggregateForKeyholder(db, d.id);
      const p = projectKeyholderEarnings(a.projectionInputs);
      rows.push({
        uid: d.id,
        username: kh.username,
        creators: a.creators,
        players: a.players,
        totalEntries: a.totalEntries,
        totalProjectedCents: p.totalProjectedCents,
      });
    }
    rows.sort((a, b) => b.totalEntries - a.totalEntries);
    data.keymaster = {
      keyholders: rows,
      rollup: {
        creators: rows.reduce((n, r) => n + r.creators, 0),
        players: rows.reduce((n, r) => n + r.players, 0),
        totalEntries: rows.reduce((n, r) => n + r.totalEntries, 0),
        totalProjectedCents: rows.every((r) => r.totalProjectedCents == null)
          ? null
          : rows.reduce((n, r) => n + (r.totalProjectedCents ?? 0), 0),
      },
    };
  }

  return data;
}
