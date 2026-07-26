// Fox Pit trivia — PILOT (2 cells only). Uses Sonnet (not Opus). 4-option MC, settled past events.
// Loads the commented ANTHROPIC_API_KEY from .env.local. Prints questions verbatim + tokens + cost.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const env = readFileSync("C:/lockin/.env.local", "utf8");
const km = env.match(/^#?\s*ANTHROPIC_API_KEY\s*=\s*"?(sk-[^\s"]+)/m);
if (!km) { console.error("No ANTHROPIC_API_KEY found in .env.local"); process.exit(1); }
const client = new Anthropic({ apiKey: km[1] });

const MODEL = "claude-sonnet-5"; // Sonnet, not Opus — settled-fact MC doesn't need the top model
const PER_CELL = 12;

const SYSTEM = [
  "You write trivia for a skill-based prediction game's PRACTICE mode.",
  "",
  "HARD RULES:",
  "1. Every question is about a SETTLED, ALREADY-DECIDED past event. Never about anything upcoming,",
  "   ongoing, scheduled, or otherwise undecided. If the answer could still change, it is invalid.",
  "2. The answer must be a matter of public record — checkable in seconds by anyone who knows the",
  "   category. No opinions, no 'best', no 'most memorable', no predictions, no counterfactuals.",
  "3. EXACTLY 4 options, exactly one correct. The 3 wrong options must be genuinely plausible to",
  "   someone who knows the category but not this specific fact — real people/teams/shows/years,",
  "   never a joke option or an obviously-wrong one.",
  "4. Never reference 'this season', 'last year', 'currently' — name the year explicitly instead.",
  "5. Prefer facts settled for a while over very recent ones.",
  "6. DIFFICULTY COMES FROM DECOY QUALITY, NOT OBSCURITY.",
  "7. PRACTICE FLOOR (tier 1, ~70% get it right): the single most famous, widely-known fact in the",
  "   category — the headline even a casual fan has heard. One clearly-best answer; the 3 decoys are",
  "   plausible category items but a fan rules them out. Do NOT make the practice floor tricky.",
  "8. TONE: conversational, fun where it fits — table-talk delivery, like a knowledgeable friend",
  "   saying it, never dry quiz-show or stiff textbook phrasing.",
  "9. NO DUPLICATE FACTS within the batch. Vary what the question asks; don't make every one 'who won'.",
].join("\n");

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: `Exactly ${PER_CELL} trivia questions.`,
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "A question about a SETTLED past event with one correct answer." },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4, description: "Exactly 4 distinct options; the 3 wrong ones are plausible, not filler." },
          correctIndex: { type: "integer", description: "0-based index into options of the correct answer." },
          factNote: { type: "string", description: "One sentence stating the fact that makes the answer correct." },
        },
        required: ["question", "options", "correctIndex", "factNote"],
      },
    },
  },
  required: ["questions"],
};

function userPrompt(category) {
  return [
    `Category: ${category}`,
    `Difficulty: PRACTICE FLOOR (tier 1) — general knowledge, easy. The single most famous fact in the category.`,
    `Target: about 70% of typical players answer correctly — tune decoy strength to that rate.`,
    "",
    `Write ${PER_CELL} questions at that difficulty, all in that category. 4 options each.`,
    "Every question independently answerable — no shared setup.",
  ].join("\n");
}

const cells = ["Reality Competition \u00b7 Survivor", "Sports \u00b7 NBA"];
let totalIn = 0, totalOut = 0;

for (const cat of cells) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(cat) }],
    tools: [{ name: "emit_trivia", description: "Return the generated trivia questions.", input_schema: TOOL_SCHEMA }],
    tool_choice: { type: "tool", name: "emit_trivia" },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  const qs = block?.input?.questions ?? [];
  totalIn += res.usage.input_tokens;
  totalOut += res.usage.output_tokens;
  console.log(`\n================ ${cat} — tier 1 (dojo) — ${qs.length} questions ================`);
  qs.forEach((q, i) => {
    console.log(`\nQ${i + 1}. ${q.question}`);
    q.options.forEach((o, oi) => console.log(`   ${oi === q.correctIndex ? "\u2713" : " "} ${String.fromCharCode(65 + oi)}. ${o}`));
    console.log(`   \u2192 ${q.factNote}`);
  });
  console.log(`\n[${cat}] tokens: in ${res.usage.input_tokens}  out ${res.usage.output_tokens}`);
}

// Sonnet pricing (stated assumption): $3 / M input, $15 / M output.
const IN = 3 / 1e6, OUT = 15 / 1e6;
const cost = totalIn * IN + totalOut * OUT;
console.log(`\n================ PILOT TOTAL — model=${MODEL} ================`);
console.log(`input tokens: ${totalIn}   output tokens: ${totalOut}`);
console.log(`cost (assumed Sonnet $3/M in + $15/M out): $${cost.toFixed(4)}  for 2 cells`);
console.log(`extrapolated to ~40 cells: ~$${(cost / 2 * 40).toFixed(2)} (before any Haiku swap)`);
