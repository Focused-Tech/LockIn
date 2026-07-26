// Fox Pit trivia — FULL generation (all 42 taxonomy subcategories at a tier). Sonnet, 4-option MC,
// settled past events. Writes to Firestore (triviaQuestions + flips triviaBatches active) in the exact
// publishTriviaBatch shape so the server's fetchTriviaForRound finds them. Q12 meta-commentary guard.
//
//   node scripts/trivia-generate.mjs [tierKey]   tierKey ∈ dojo|coliseum|hightable|suite (default dojo)
import Anthropic from "@anthropic-ai/sdk";
import admin from "firebase-admin";
import { readFileSync } from "fs";

// ---- env (.env.local; ANTHROPIC key is commented, Firebase keys are live) ----
const ENV = readFileSync("C:/lockin/.env.local", "utf8");
const val = (k) => {
  const m = ENV.match(new RegExp(`^#?\\s*${k}\\s*=\\s*"?([^\\n"]+)`, "m"));
  return m ? m[1].trim() : null;
};
const ANTHROPIC_KEY = val("ANTHROPIC_API_KEY");
const FB_PROJECT = val("FIREBASE_PROJECT_ID");
const FB_EMAIL = val("FIREBASE_CLIENT_EMAIL");
const FB_KEY = (val("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
if (!ANTHROPIC_KEY || !FB_PROJECT || !FB_EMAIL || !FB_KEY) {
  console.error("Missing creds in .env.local:", { ANTHROPIC_KEY: !!ANTHROPIC_KEY, FB_PROJECT: !!FB_PROJECT, FB_EMAIL: !!FB_EMAIL, FB_KEY: !!FB_KEY });
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
admin.initializeApp({ credential: admin.credential.cert({ projectId: FB_PROJECT, clientEmail: FB_EMAIL, privateKey: FB_KEY }) });
const db = admin.firestore();

const MODEL = "claude-sonnet-5";
const PER_CELL = 12;
const CONCURRENCY = 4;
const TIER = process.argv[2] || "dojo";

// Taxonomy (mirrors FOXPIT_TRIVIA_TAXONOMY) → flattened "Parent · Sub" cells.
const TAXONOMY = {
  "Reality Competition": ["Survivor", "Big Brother", "The Challenge", "Love Island", "Bachelor Nation", "90 Day Fiance", "Drag Race", "Hell's Kitchen", "MasterChef", "Top Chef", "Next Level Chef"],
  Sitcoms: ["90s Black sitcoms", "Friends/Seinfeld era", "Office/mockumentary", "Abbott/current"],
  Drama: ["Power universe", "prestige cable", "current streaming originals"],
  "Game Shows": ["Price Is Right", "Feud", "Wheel/game-show history", "Deal or No Deal"],
  Sports: ["NBA", "NFL", "boxing/UFC", "college hoops", "big televised moments"],
  Music: ["hip-hop/R&B", "videos & VMAs", "Verzuz", "halftime shows"],
  "News/Politics": ["named person + measure + year"],
  Awards: ["Emmys", "BET", "Oscars"],
  Movies: ["franchises", "Black cinema", "box office"],
  "TV Mechanics": ["finales", "catchphrases", "theme songs", "spin-offs"],
  // Added per Frank so the tower's crypto/weather categories have pooled trivia too (settled PAST
  // facts — milestones/records, never live prices or forecasts). Brings the taxonomy to 44 cells.
  Crypto: ["Bitcoin & crypto milestones"],
  Weather: ["record storms & weather history"],
};
const CELLS = Object.entries(TAXONOMY).flatMap(([parent, subs]) => subs.map((sub) => `${parent} \u00b7 ${sub}`));

const TIER_BRIEF = {
  dojo: "PRACTICE FLOOR (tier 1) — general knowledge, easy. The single most famous fact in the category. One clearly-best answer; 3 plausible decoys. ~70% get it. Do NOT make it tricky.",
  coliseum: "TIER 2 — one genuinely plausible decoy a casual fan might fall for. Still a well-known fact. ~55% get it.",
  hightable: "TIER 3 — specifics: exact years, margins, chart positions, runners-up; all four plausible to a fan. ~40% get it.",
  suite: "TIER 4 — expert: precise figures, second-order details; near-miss distractors only an expert rules out. ~28% get it.",
};

const SYSTEM = [
  "You write trivia for a skill-based prediction game's PRACTICE mode.",
  "",
  "HARD RULES:",
  "1. Every question is about a SETTLED, ALREADY-DECIDED past event. Never upcoming/ongoing/undecided.",
  "2. The answer is a matter of public record — checkable in seconds. No opinions, no 'best/most memorable'.",
  "3. EXACTLY 4 options, exactly one correct. The 3 wrong ones are genuinely plausible — real people/teams/",
  "   shows/years — never a joke or an obviously-wrong option.",
  "4. Never reference 'this season/last year/currently' — name the year explicitly.",
  "5. Prefer facts settled for a while over very recent ones.",
  "6. DIFFICULTY COMES FROM DECOY QUALITY, NOT OBSCURITY.",
  "7. TONE: conversational, table-talk delivery, like a knowledgeable friend — never dry quiz-show phrasing.",
  "8. NO DUPLICATE FACTS within the batch; vary what the question asks.",
  "9. Ask the question ONCE, cleanly. NEVER put meta-commentary, self-correction, or hedging in the question",
  "   text — no 'wait', 'let me confirm', 'actually', 'hmm', 'on second thought'. If you catch a mistake,",
  "   rewrite the whole question; never narrate the correction.",
].join("\n");

const TOOL = {
  name: "emit_trivia",
  description: "Return the generated trivia questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array", description: `Exactly ${PER_CELL} questions.`,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correctIndex: { type: "integer" },
            factNote: { type: "string" },
          },
          required: ["question", "options", "correctIndex", "factNote"],
        },
      },
    },
    required: ["questions"],
  },
};

const META_RE = /\b(wait|hmm|actually,|let'?s confirm|let me confirm|on second thought|i think|not sure)\b/i;
function validate(q) {
  if (!q || typeof q.question !== "string") return false;
  if (META_RE.test(q.question)) return false;                       // Q12 guard
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (new Set(q.options.map((o) => String(o).toLowerCase())).size !== 4) return false;
  if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) return false;
  return true;
}
const stem = (s) => s.toLowerCase().replace(/[^a-z ]+/g, "").replace(/\b(the|a|an|in|of|who|what|which|was|were|did|is)\b/g, "").replace(/\s+/g, " ").trim();

async function genCell(category, attempt = 1) {
  const res = await client.messages.create({
    model: MODEL, max_tokens: 8000, system: SYSTEM,
    messages: [{ role: "user", content: [
      `Category: ${category}`, `Difficulty: ${TIER_BRIEF[TIER]}`,
      `Write ${PER_CELL} questions at that difficulty, all in that category. 4 options each. Independently answerable.`,
    ].join("\n") }],
    tools: [TOOL], tool_choice: { type: "tool", name: "emit_trivia" },
  });
  const raw = (res.content.find((b) => b.type === "tool_use")?.input?.questions) ?? [];
  const usage = res.usage;
  // validate + intra-cell stem-dedup
  const seen = new Set();
  const good = [];
  for (const q of raw) {
    if (!validate(q)) continue;
    const k = stem(q.question);
    if (seen.has(k)) continue;
    seen.add(k);
    good.push(q);
  }
  if (good.length < 8 && attempt < 2) {
    const retry = await genCell(category, attempt + 1);
    return { questions: retry.questions, usage: { input_tokens: usage.input_tokens + retry.usage.input_tokens, output_tokens: usage.output_tokens + retry.usage.output_tokens }, dropped: raw.length - good.length };
  }
  return { questions: good, usage, dropped: raw.length - good.length };
}

// ---- run with a small concurrency pool ----
const results = new Array(CELLS.length);
let totalIn = 0, totalOut = 0, totalDropped = 0;
let idx = 0;
async function worker() {
  while (idx < CELLS.length) {
    const my = idx++;
    const cat = CELLS[my];
    try {
      const r = await genCell(cat);
      results[my] = { category: cat, tier: TIER, questions: r.questions };
      totalIn += r.usage.input_tokens; totalOut += r.usage.output_tokens; totalDropped += r.dropped;
      console.log(`[${my + 1}/${CELLS.length}] ${cat}: ${r.questions.length} kept${r.dropped ? ` (${r.dropped} dropped)` : ""}`);
    } catch (e) {
      console.error(`[${my + 1}/${CELLS.length}] ${cat} FAILED:`, e.message);
      results[my] = { category: cat, tier: TIER, questions: [] };
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const cells = results.filter((c) => c && c.questions.length > 0);
const batchId = `batch_${Date.now()}`;
const generatedAt = Date.now();

// rows (publishTriviaBatch shape)
const rows = [];
for (const cell of cells) {
  cell.questions.forEach((q, i) => rows.push({
    // Firestore doc ids can't contain "/", so sanitize ALL non-alphanumerics to "-" (the slug is only
    // an id — retrieval is by the `category` field, not the id). "Friends/Seinfeld era" broke the run.
    id: `${batchId}_${cell.tier}_${cell.category.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}_${i}`,
    category: cell.category, tier: cell.tier, question: q.question, options: q.options,
    correctIndex: q.correctIndex, factNote: q.factNote, batchId, generatedAt,
  }));
}
if (rows.length === 0) { console.error("No questions generated — refusing to publish."); process.exit(1); }

// write rows in <=400 chunks
for (let i = 0; i < rows.length; i += 400) {
  const batch = db.batch();
  for (const row of rows.slice(i, i + 400)) batch.set(db.collection("triviaQuestions").doc(row.id), row);
  await batch.commit();
}
// archive prior active batches, activate this one
const live = await db.collection("triviaBatches").where("status", "==", "active").get();
const flip = db.batch();
for (const d of live.docs) flip.update(d.ref, { status: "archived" });
flip.set(db.collection("triviaBatches").doc(batchId), {
  batchId, status: "active", generatedAt, questionCount: rows.length, categories: cells.map((c) => c.category),
});
await flip.commit();

const cost = totalIn * 3e-6 + totalOut * 15e-6;
console.log(`\n================ PUBLISHED ================`);
console.log(`tier=${TIER}  cells=${cells.length}/${CELLS.length}  questions=${rows.length}  dropped=${totalDropped}`);
console.log(`batchId=${batchId} (now ACTIVE, prior archived)`);
console.log(`tokens: in ${totalIn}  out ${totalOut}   cost≈$${cost.toFixed(4)} (Sonnet $3/$15 per M)`);
process.exit(0);
