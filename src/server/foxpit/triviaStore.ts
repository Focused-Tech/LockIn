import "server-only";

/**
 * FOX PIT — trivia cache (Firestore).
 *
 * Write path: the batch job (triviaGen) persists a whole batch, then flips it
 * active and ARCHIVES the prior one — archived questions stay readable so a
 * round already in flight never loses its cards.
 *
 * Read path: deal time reads the ACTIVE batch only, and never calls the model.
 */
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/types";
import {
  TRIVIA_CATEGORIES,
  batchIsStale,
  type TriviaQuestion,
} from "@/lib/foxpit/trivia";
import type { GenerateCellResult } from "./triviaGen";
import type { FoxPitRoomKey } from "@/lib/foxpit";

/** Firestore chunks batched writes at 500 ops; stay under it. */
const WRITE_CHUNK = 400;

export interface TriviaBatchDoc {
  batchId: string;
  status: "active" | "archived";
  generatedAt: number;
  questionCount: number;
  categories: string[];
}

/**
 * Persist a generated batch and make it the active one, archiving whatever was
 * active before. Returns the number of questions written.
 */
export async function publishTriviaBatch(
  db: Firestore,
  batchId: string,
  cells: GenerateCellResult[],
  generatedAt: number,
): Promise<number> {
  const rows: TriviaQuestion[] = [];
  for (const cell of cells) {
    cell.questions.forEach((q, i) => {
      rows.push({
        id: `${batchId}_${cell.tier}_${cell.category.replace(/\s+/g, "-").toLowerCase()}_${i}`,
        category: cell.category,
        tier: cell.tier,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        factNote: q.factNote,
        batchId,
        generatedAt,
      });
    });
  }

  if (rows.length === 0) throw new Error("Refusing to publish an empty trivia batch");

  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + WRITE_CHUNK)) {
      batch.set(db.collection(COLLECTIONS.triviaQuestions).doc(row.id), row);
    }
    await batch.commit();
  }

  // Archive the outgoing batch(es) BEFORE activating the new one, so there is
  // never a window with two active batches.
  const live = await db
    .collection(COLLECTIONS.triviaBatches)
    .where("status", "==", "active")
    .get();
  const flip = db.batch();
  for (const doc of live.docs) flip.update(doc.ref, { status: "archived" });
  flip.set(db.collection(COLLECTIONS.triviaBatches).doc(batchId), {
    batchId,
    status: "active",
    generatedAt,
    questionCount: rows.length,
    categories: TRIVIA_CATEGORIES,
  } satisfies TriviaBatchDoc);
  await flip.commit();

  return rows.length;
}

/** The currently active batch, or null if the pool has never been generated. */
export async function fetchActiveBatch(db: Firestore): Promise<TriviaBatchDoc | null> {
  const snap = await db
    .collection(COLLECTIONS.triviaBatches)
    .where("status", "==", "active")
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0]!.data() as TriviaBatchDoc);
}

/** Does the pool need regenerating? Also true when it has never been built. */
export async function triviaNeedsRegen(db: Firestore, now: number): Promise<boolean> {
  const active = await fetchActiveBatch(db);
  return !active || batchIsStale(active.generatedAt, now);
}

/**
 * CACHE-ONLY deal for a round. Pulls the active batch's questions for the given categories at the
 * given tier, EXCLUDES every id in the player's triviaSeen, MARKS the dealt ids seen (SEEN = SHOWN,
 * at expose), and returns them shuffled. Makes ZERO model calls.
 *
 * NEVER-REPEAT CONTRACT (Fox Pit trivia): a seen id is never re-dealt. All chosen categories are
 * pooled together, so a dry category is already back-filled from the others. If the combined FRESH
 * pool still can't fill `want`, we deal what's fresh (fewer cards) and log the shortfall for the
 * generation top-up — we do NOT recycle a seen question. Recycling is the one forbidden move.
 */
export async function fetchTriviaForRound(
  db: Firestore,
  uid: string,
  tier: FoxPitRoomKey,
  categories: string[],
  want: number,
): Promise<TriviaQuestion[]> {
  const active = await fetchActiveBatch(db);
  if (!active) {
    console.error("[trivia] no active batch — the pool has not been generated");
    throw new Error("Practice trivia pool is empty. Run the trivia batch job.");
  }

  const cats = categories.length ? categories : TRIVIA_CATEGORIES;
  // Firestore `in` caps at 30 values; chunk the category filter.
  const pool: TriviaQuestion[] = [];
  for (let i = 0; i < cats.length; i += 30) {
    const snap = await db
      .collection(COLLECTIONS.triviaQuestions)
      .where("batchId", "==", active.batchId)
      .where("tier", "==", tier)
      .where("category", "in", cats.slice(i, i + 30))
      .get();
    for (const d of snap.docs) pool.push(d.data() as TriviaQuestion);
  }

  const seen = await fetchSeenIds(db, uid);
  // FRESH ONLY — never fall back to the full pool. A seen id is never re-dealt.
  const unseen = pool.filter((q) => !seen.has(q.id));
  if (unseen.length < want) {
    console.error(
      `[trivia] fresh pool short: ${unseen.length}/${want} for tier=${tier} cats=[${cats.join(",")}] — ` +
        `dealing fresh only, NO recycle. Trigger a generation top-up for these (subcategory,tier) pools.`,
    );
  }

  // Fisher-Yates over the FRESH pool, then take up to `want`.
  for (let i = unseen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unseen[i], unseen[j]] = [unseen[j]!, unseen[i]!];
  }
  const dealt = unseen.slice(0, want);

  // SEEN = SHOWN: mark the moment they're dealt onto the slate (abandoned rounds still burn them).
  await markSeen(db, uid, dealt.map((q) => q.id));
  return dealt;
}

/** Question ids this player has already been dealt in the current cycle. */
export async function fetchSeenIds(db: Firestore, uid: string): Promise<Set<string>> {
  const snap = await db
    .collection(COLLECTIONS.users)
    .doc(uid)
    .collection(COLLECTIONS.triviaSeen)
    .get();
  return new Set(snap.docs.map((d) => d.id));
}

/** Mark questions as dealt so they don't repeat within this cycle. */
export async function markSeen(
  db: Firestore,
  uid: string,
  questionIds: string[],
): Promise<void> {
  if (questionIds.length === 0) return;
  const col = db.collection(COLLECTIONS.users).doc(uid).collection(COLLECTIONS.triviaSeen);
  const batch = db.batch();
  for (const id of questionIds) {
    batch.set(col.doc(id), { seenAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
}
