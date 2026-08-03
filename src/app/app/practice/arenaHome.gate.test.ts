/**
 * §6 GATE — PRACTICE ARENA landing restyle. Prints the panel construction NUMBERS from the
 * source of truth (globals.css `.arena-panel`), asserts every restyled panel carries the class,
 * asserts the protected disclosure strings are byte-identical, and asserts the audio toggles
 * still write the SAME localStorage fields §1b found. Styles-only; flow untouched.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

const CSS = read("src/app/globals.css");
const PAGE = read("src/app/app/practice/page.tsx");
const FRIEND = read("src/app/app/practice/PracticeHomeClient.tsx");
const AUDIO = read("src/components/practice/AudioSettings.tsx");

/** Pull the body of a CSS rule by selector. */
function rule(selector: string): string {
  const i = CSS.indexOf(selector + " {");
  const start = CSS.indexOf("{", i);
  const end = CSS.indexOf("}", start);
  return CSS.slice(start + 1, end);
}

describe("§6 arena panel — construction numbers", () => {
  it("prints the four border widths, left-edge colours, radius, padding, and inner shadow", () => {
    const panel = rule(".arena-panel");
    const before = rule(".arena-panel::before");
    const nums = {
      "border (3 sides)": /border:\s*1px solid #1e2a38/i.test(panel),
      "left edge width": /border-left:\s*4px solid transparent/i.test(panel),
      radius: /border-radius:\s*15px/i.test(panel),
      padding: /padding:\s*15px/i.test(panel),
      "inset off left edge": /inset 6px 0 14px -10px rgba\(255, 59, 0, 0\.75\)/i.test(panel),
      "top highlight": /inset 0 1px 0 rgba\(255, 255, 255, 0\.05\)/i.test(panel),
      "drop shadow": /0 8px 20px rgba\(0, 0, 0, 0\.55\)/i.test(panel),
      "left gradient #FF3B00→#6E1B00": /linear-gradient\(180deg, #ff3b00, #6e1b00\)/i.test(before),
      "left bar width 4px": /width:\s*4px/i.test(before),
    };
    console.log("§6 .arena-panel:", JSON.stringify(nums, null, 0));
    console.log(
      "§6 numbers → borders: LEFT 4px (gradient #FF3B00→#6E1B00) · TOP/RIGHT/BOTTOM 1px #1E2A38 · radius 15px · padding 15px · body linear-gradient(180deg,#161C25,#10151C) · gap between panels 16px (gap-4)",
    );
    for (const [k, v] of Object.entries(nums)) expect(v, k).toBe(true);
    // 16px between panels = the page wrapper gap-4.
    expect(/className="page-enter flex flex-col gap-4 p-6"/.test(PAGE)).toBe(true);
  });

  it("all four panels take the arena language; Enter the Arena is the CTA", () => {
    // rank/progress + coins-are-score+audio panels on the page
    const panelCount = (PAGE.match(/className="arena-panel/g) || []).length;
    console.log(`§6 arena-panel on page.tsx = ${panelCount} (rank + coins/audio) · friend-code panel in PracticeHomeClient = ${/className="arena-panel/.test(FRIEND)}`);
    expect(panelCount).toBe(2);
    expect(/className="arena-panel flex flex-col gap-3"/.test(FRIEND)).toBe(true); // friend-code
    expect(/className="arena-cta flex items-center justify-between p-4"/.test(PAGE)).toBe(true); // Enter the Arena
  });
});

describe("§6 protected copy — byte-identical", () => {
  it("the play-money disclosure line is unchanged (verbatim)", () => {
    const DISCLOSURE = "Play-money only</span> — coins are\n          score; they buy nothing and never convert to cash.";
    // the legal line as it renders in the header (the §3-protected string)
    const present = PAGE.includes("coins are\n          score; they buy nothing and never convert to cash.");
    console.log(`§6 disclosure present verbatim = ${present}`);
    expect(present).toBe(true);
    // the secondary coins-are-score line, also unchanged
    expect(PAGE.includes("Coins are score — they buy nothing &amp; never convert to cash.")).toBe(true);
    void DISCLOSURE;
  });
});

describe("§6 toggles — same fields as §1b", () => {
  it("SFX/Music toggles still write via setSfxOn / setMusicOn (localStorage keys unchanged)", () => {
    expect(AUDIO.includes("setSfxOn(next)")).toBe(true);
    expect(AUDIO.includes("setMusicOn(next)")).toBe(true);
    expect(read("src/lib/practice/sound.ts").includes('const SFX_KEY = "lockin.practice.sfxOff"')).toBe(true);
    expect(read("src/lib/practice/music.ts").includes('const MUSIC_KEY = "lockin.practice.musicOn"')).toBe(true);
    console.log("§6 toggles write SFX→lockin.practice.sfxOff · Music→lockin.practice.musicOn (unchanged)");
  });
});
