// @vitest-environment jsdom
/**
 * GATE §2 — the boss/underling seat screen (TablePanel) is backed by the room's BALLROOM SEAT PLATE
 * (opponent seated behind a table baked into the plate), NOT the top-down floor tile that made the
 * character read as sitting on the floor.
 *
 * The seated character is BAKED INTO the plate (these are finished seat scenes), so there is no
 * separate cutout DOM element — the honest assertion is: the seat backdrop is a /rooms/seat/ ballroom
 * plate for that room, and the old /floors/floor_ tile no longer appears. Drives the real mounted
 * TablePanel for every room, boss and underling.
 */
import { describe, it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

// Room.tsx transitively imports the server-only actions module; stub it (same as DealPhase.test).
vi.mock("../../actions", () => ({ applyFoxPitCoins: async () => ({}), dealFoxRound: async () => ({ ok: true, slates: [] }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import { TablePanel } from "./Room";
import { roomByKey, type FoxPitRoomKey } from "@/lib/foxpit";

const ROOMS: FoxPitRoomKey[] = ["dojo", "coliseum", "hightable", "suite"];
const noop = () => {};

function backdropSrc(host: HTMLElement): string {
  // the seat plate is the first full-bleed <img> in the panel
  const img = host.querySelector("img") as HTMLImageElement | null;
  return img?.getAttribute("src") ?? "";
}

describe("GATE §2 — seat screen uses the ballroom seat plate, not the floor tile", () => {
  const results: string[] = [];

  it.each(ROOMS)("%s — boss + underling seats are ballroom plates", (key) => {
    const room = roomByKey(key);

    for (const bossTable of [true, false]) {
      const el = document.createElement("div");
      document.body.appendChild(el);
      const root = createRoot(el);
      flushSync(() =>
        root.render(
          h(TablePanel as never, {
            room, index: bossTable ? 0 : 1,
            opponent: bossTable ? null : { name: "Underling", winPct: 42, art: "" },
            freeKeycard: false, username: "Member", avatarUrl: null,
            bossTable, onClose: noop, onConfirm: noop,
          } as never),
        ),
      );

      const src = backdropSrc(el);
      const isSeatPlate = src.includes(`/foxpit/rooms/seat/seat_${key}_`);
      const isFloorTile = src.includes("/foxpit/floors/floor_");

      expect(isSeatPlate, `${key} ${bossTable ? "boss" : "underling"}: backdrop ${src} is not a seat plate`).toBe(true);
      expect(isFloorTile, `${key}: still using the floor tile`).toBe(false);

      results.push(`${key.padEnd(9)} ${bossTable ? "boss     " : "underling"}  ${src.replace("/foxpit/rooms/seat/", "")}`);
      flushSync(() => root.unmount());
      el.remove();
    }
  });

  it("prints the per-room results", () => {
    // eslint-disable-next-line no-console
    console.log("SEAT-PLATE GATE:\n" + results.map((r) => "  " + r).join("\n"));
    expect(results).toHaveLength(8);
  });
});
