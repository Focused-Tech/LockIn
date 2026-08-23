/**
 * DEMO CAST — the Fox Pit tower's own characters, used as the worked example everywhere a demo
 * needs a host or a contender.
 *
 * WHY NOT REAL NAMES. `design/lockin_cordell_demo_v2.html` is built on marquee names — real
 * broadcasters as hosts, real athletes inside the legs. None of that ships. A demo that names a
 * living person puts invented words and invented performance in their mouth, which is exactly what
 * `src/lib/moderation/creatorContent.ts` refuses when a creator does it. The reference is used for
 * layout, interaction and copy only; the cast is replaced wholesale.
 *
 * The tower cast is the right substitute: it is ours, it is already canon, and it carries no
 * likeness risk. Names are IMPORTED from the tower's own source rather than re-typed, so the roster
 * cannot drift from `src/lib/foxpit/underlings.ts` / `rules.ts`.
 *
 * READ-ONLY with respect to the Fox Pit. This module imports from the tower and writes nothing back;
 * no tower file is modified by the demo.
 */
import { ROOM_RULES } from "@/lib/foxpit/rules";
import { UNDERLINGS } from "@/lib/foxpit/underlings";

export interface DemoCharacter {
  /** Canonical name, straight from the tower source. */
  name: string;
  /** Two-letter monogram for the avatar chip. */
  initials: string;
  /** Which room they belong to — the demo's stand-in for a category. */
  room: string;
}

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1
    ? parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
    : name.slice(0, 2)
  ).toUpperCase();
};

/** The four room bosses. These host the demo slates — the reference's "Category Boss" role. */
export const DEMO_BOSSES: DemoCharacter[] = (
  ["dojo", "coliseum", "hightable", "suite"] as const
).map((key) => ({
  name: ROOM_RULES[key].boss,
  initials: initialsOf(ROOM_RULES[key].boss),
  room: key,
}));

/** The contenders. These are the SUBJECTS inside the legs, never the hosts. */
export const DEMO_CONTENDERS: DemoCharacter[] = (["coliseum", "hightable"] as const).flatMap(
  (key) => (UNDERLINGS[key] ?? []).map((u) => ({ name: u.name, initials: initialsOf(u.name), room: key })),
);

/** Every name the demo is allowed to print. The gate test asserts nothing outside this set ships. */
export const DEMO_NAME_ALLOWLIST: readonly string[] = [
  ...DEMO_BOSSES.map((c) => c.name),
  ...DEMO_CONTENDERS.map((c) => c.name),
];

export const bossByRoom = (room: string): DemoCharacter | undefined =>
  DEMO_BOSSES.find((b) => b.room === room);
