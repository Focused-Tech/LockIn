/**
 * §5 GATE — BEGINNER IS COINS ONLY. No dollar figure renders anywhere in the beginner lane.
 * Source-level guard: the component must not call formatCents and must contain no rendered "$"
 * (a `$` that isn't the start of a `${...}` template interpolation).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(process.cwd(), "src/app/app/beginner/BeginnerJourney.tsx"),
  "utf8",
);

describe("§5 beginner — coins only, no dollar figure", () => {
  it("renders no '$' and never calls formatCents", () => {
    // A rendered dollar is a `$` NOT immediately followed by `{` (which would be a template literal).
    const renderedDollars = SRC.match(/\$(?!\{)/g) ?? [];
    // eslint-disable-next-line no-console
    console.log(`§5 beginner rendered '$' count: ${renderedDollars.length} · formatCents uses: ${(SRC.match(/formatCents/g) ?? []).length}`);
    expect(renderedDollars.length).toBe(0);
    expect(SRC.includes("formatCents")).toBe(false);
  });
});
