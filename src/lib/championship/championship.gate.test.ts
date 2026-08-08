/**
 * CHAMPIONSHIP + LOCKSMITH-SCREEN GATE — the slice's non-render contracts:
 *   · input autosize + tail-visibility (pure geometry: caps at 4 lines, overflow "auto" so the tail
 *     is reachable, never clipped; the component scrolls to the tail)
 *   · strip renders "—" while the qualification line is unarmed
 *   · trigger cards fire exactly once (evaluateTrigger honours the seen-record; milestone disarmed)
 *   · chip dock copy is DATA (per mode) and the dock never wraps to a second row
 *   · /app/championship registered + reachable from the strip
 *   · admin screen 404s non-admins + writes only through the existing actions
 *   · floating door removed from the Locksmith screen; START PLAYING remains as the CTA
 *
 * (The rendered dock-persists / chip-tap-sends / door-absent checks live in the render test.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { autosizeTextarea } from "@/lib/dom/autosize";
import {
  divisionForTier,
  divisionLabelForTiers,
  winRateLabel,
  qualificationLineLabel,
  standingLabel,
} from "@/lib/championship/strip";
import { evaluateTrigger, milestoneReached, type TriggerState } from "@/lib/championship/triggers";
import { championshipChipsForMode, chipAnswer, CHAMPIONSHIP_CHIPS } from "@/lib/championship/copy";
import { QUALIFICATION_LINE, CHAMPIONSHIP_SEASON_MILESTONE } from "@/lib/contest/architectSet";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("input autosize + tail-visibility", () => {
  it("caps at exactly 4 lines and makes the tail SCROLLABLE (overflow auto) when content overflows", () => {
    const line = 20, pad = 16, maxLines = 4; // maxPx = 20*4 + 16 = 96
    const big = autosizeTextarea({ scrollHeight: 300, lineHeightPx: line, paddingYPx: pad, maxLines });
    expect(big.heightPx).toBe(96); // never taller than 4 lines
    expect(big.overflowY).toBe("auto"); // tail reachable — NOT clipped
    expect(big.capped).toBe(true);
  });
  it("grows freely below the cap (no scroll needed)", () => {
    const small = autosizeTextarea({ scrollHeight: 40, lineHeightPx: 20, paddingYPx: 16, maxLines: 4 });
    expect(small.heightPx).toBe(40);
    expect(small.overflowY).toBe("hidden");
    expect(small.capped).toBe(false);
  });
  it("a 200-char single line overflows the cap → autosize keeps it scrollable (tail visible)", () => {
    // ~200 chars in a ~250px box wraps to several lines; model that as a tall scrollHeight.
    const r = autosizeTextarea({ scrollHeight: 190, lineHeightPx: 20, paddingYPx: 16, maxLines: 4 });
    expect(r.capped).toBe(true);
    expect(r.overflowY).toBe("auto");
  });
  it("the component measures on EVERY value change and scrolls to the tail", () => {
    const src = read("src/components/app/TutorialLauncher.tsx");
    expect(src).toContain("useEffect(() => {\n    autoGrow();"); // runs for typing, STT, chips
    expect(src).toContain("el.scrollTop = el.scrollHeight"); // tail scrolled into view
    expect(src).toContain("autosizeTextarea(");
    expect(src).toContain("maxLines: 4");
  });
});

describe("strip renders '—' while unarmed", () => {
  it("QUALIFICATION_LINE ships unset → line + standing are '—', never a number", () => {
    expect(QUALIFICATION_LINE).toBeNull();
    expect(qualificationLineLabel(QUALIFICATION_LINE)).toBe("—");
    expect(standingLabel(72, QUALIFICATION_LINE)).toBe("—");
  });
  it("division + win rate still render (division from top tier; win rate rounded)", () => {
    expect(divisionForTier(25)).toBe("$25");
    expect(divisionLabelForTiers([5, 25, 10])).toBe("$25"); // top tier
    expect(divisionLabelForTiers([])).toBe("—"); // no paid entries
    expect(winRateLabel(66.6)).toBe("67%");
    expect(winRateLabel(null)).toBe("—");
  });
});

describe("trigger cards fire exactly once", () => {
  const seenNone: TriggerState["seen"] = { first_win: false, division_change: false, season_milestone: false };
  it("returns a card when its condition is met and unseen; null once seen", () => {
    expect(evaluateTrigger({ firstWin: true, divisionChanged: false, milestoneReached: false, seen: seenNone })).toBe("first_win");
    expect(
      evaluateTrigger({ firstWin: true, divisionChanged: false, milestoneReached: false, seen: { ...seenNone, first_win: true } }),
    ).toBeNull();
  });
  it("priority order first_win → division_change → season_milestone", () => {
    expect(evaluateTrigger({ firstWin: false, divisionChanged: true, milestoneReached: true, seen: seenNone })).toBe("division_change");
    expect(evaluateTrigger({ firstWin: false, divisionChanged: false, milestoneReached: true, seen: seenNone })).toBe("season_milestone");
  });
  it("season milestone is DISARMED while the architect date is unset", () => {
    expect(CHAMPIONSHIP_SEASON_MILESTONE).toBeNull();
    expect(milestoneReached(CHAMPIONSHIP_SEASON_MILESTONE, Date.now())).toBe(false);
    expect(milestoneReached("2020-01-01", 999)).toBe(false); // date set but not reached at t=999ms
    expect(milestoneReached("2020-01-01", Date.parse("2020-01-02"))).toBe(true);
  });
});

describe("chip dock copy is DATA, per mode, and never wraps", () => {
  it("championship chips come from the store; beginner (coins) shows none; creator adds playoffs", () => {
    expect(championshipChipsForMode("beginner")).toEqual([]);
    const adv = championshipChipsForMode("advanced").map((c) => c.id);
    expect(adv).toContain("what");
    expect(adv).not.toContain("creator_playoffs");
    expect(championshipChipsForMode("creator").map((c) => c.id)).toContain("creator_playoffs");
  });
  it("a pending answer omits numbers and points at the rules page", () => {
    const chip = CHAMPIONSHIP_CHIPS[0]!;
    expect(chip.answer).toBe(""); // pending
    expect(chipAnswer(chip)).toContain("Championship page");
    expect(/\d/.test(chipAnswer(chip))).toBe(false); // no unset numbers stated
  });
  it("the dock frame is single-row: nowrap + horizontal scroll, no second row", () => {
    const dock = read("src/components/app/ChipDock.tsx");
    expect(dock).toContain("flex-nowrap");
    expect(dock).toContain("overflow-x-auto");
    expect(dock).toContain("whitespace-nowrap");
    expect(dock).toContain("shrink-0");
  });
  it("the dock is rendered OUTSIDE the collapsed conditional (persists through minimize)", () => {
    const src = read("src/components/app/TutorialLauncher.tsx");
    // The dock sits between the hero and the transcript, unconditional on `collapsed`.
    expect(src).toContain("<ChipDock chips={chips} onPick={onPickChip} />");
    expect(src).toContain("championshipChipsForMode(mode)");
  });
});

describe("/app/championship registered + reachable from the strip", () => {
  it("the rules page renders section slots with a pending placeholder (no invented copy)", () => {
    const page = read("src/app/app/championship/page.tsx");
    expect(page).toContain("CHAMPIONSHIP_SECTIONS");
    expect(page).toContain("CHAMPIONSHIP_SECTION_PENDING");
  });
  it("the strip links to /app/championship and only mounts on the advanced board", () => {
    const strip = read("src/app/app/championship/ChampionshipStrip.tsx");
    expect(strip).toContain('href="/app/championship"');
    const board = read("src/app/app/leaderboard/page.tsx");
    expect(board).toContain("advanced ? await fetchChampionshipStrip");
    expect(board).toContain("{champStrip && <ChampionshipStrip");
  });
});

describe("admin keyholder screen — 404 gate + no new write paths", () => {
  it("404s non-admins with the notFound gate", () => {
    const page = read("src/app/admin/keyholders/page.tsx");
    expect(page).toContain("if (!(await isCurrentUserAdmin())) notFound();");
  });
  it("toggles round-trip through the EXISTING actions; the admin read module writes nothing", () => {
    const client = read("src/app/admin/keyholders/AdminKeyholders.tsx");
    expect(client).toContain('from "./actions"'); // setKeyholder/setKeymaster
    expect(client).toContain("setKeyholder(");
    expect(client).toContain("setKeymaster(");
    const search = read("src/app/admin/keyholders/search.ts");
    expect(search.includes(".set(")).toBe(false);
    expect(search.includes(".update(")).toBe(false);
  });
});

describe("floating door removed; START PLAYING remains", () => {
  it("the door element and its ref are gone from the Locksmith screen", () => {
    const src = read("src/components/app/TutorialLauncher.tsx");
    expect(src.includes("step through the door")).toBe(false); // door aria-label gone
    expect(src.includes("borderRadius: \"9px 9px 3px 3px\"")).toBe(false); // door shape gone
  });
  it("START PLAYING is still present and wired to finish()", () => {
    const src = read("src/components/app/TutorialLauncher.tsx");
    expect(/Start\s*<br\s*\/>\s*Playing/.test(src)).toBe(true);
    // its onClick is finish (the CTA still works)
    const idx = src.search(/Start\s*<br\s*\/>\s*Playing/);
    expect(src.lastIndexOf("onClick={finish}", idx)).toBeGreaterThan(-1);
  });
});
