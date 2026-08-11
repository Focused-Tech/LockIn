/**
 * Seed the `subcategories` Firestore index (B) from the canonical TS seed.
 *
 * Usage:  node --env-file=.env.local scripts/seed-subcategories.mjs
 *
 * SINGLE SOURCE: the data lives in src/lib/subcategories/seed.ts. This script transpiles that file
 * (its imports are type-only, so it becomes self-contained data) and writes each row to
 * subcategories/{slug}. Idempotent (merge on slug). After seeding, add NEW shows as Firestore docs —
 * they appear in creator search with NO deploy (the search action merges Firestore over the seed).
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { transform } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

// Transpile the canonical TS seed (type-only imports are erased → pure data) and import it.
const src = readFileSync(new URL("../src/lib/subcategories/seed.ts", import.meta.url), "utf8");
const { code } = await transform(src, { loader: "ts", format: "esm" });
const tmp = join(mkdtempSync(join(tmpdir(), "subseed-")), "seed.mjs");
writeFileSync(tmp, code);
const { SUBCATEGORY_SEED } = await import(pathToFileURL(tmp).href);

let n = 0;
const SIZE = 400;
for (let i = 0; i < SUBCATEGORY_SEED.length; i += SIZE) {
  const batch = db.batch();
  for (const sub of SUBCATEGORY_SEED.slice(i, i + SIZE)) {
    batch.set(
      db.collection("subcategories").doc(sub.slug),
      { ...sub, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    n++;
  }
  await batch.commit();
}
console.log(`Seeded ${n} subcategories (${SUBCATEGORY_SEED.filter((s) => s.domain === "entertainment").length} entertainment, ${SUBCATEGORY_SEED.filter((s) => s.domain === "sports").length} sports).`);
process.exit(0);
