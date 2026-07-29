// @vitest-environment jsdom
/** §3.1 GATE — the resume checkpoint round-trips and the Continue deep-link targets the exact
 *  room/table/round; nothing saved → no href (the lobby then falls back to the map). */
import { describe, it, expect, beforeEach } from "vitest";
import { writeFoxCheckpoint, readFoxCheckpoint, clearFoxCheckpoint, foxResumeHref } from "./checkpoint";

describe("§3.1 fox pit resume checkpoint", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips room/table/round", () => {
    writeFoxCheckpoint({ room: "coliseum", table: 3, round: 2 });
    expect(readFoxCheckpoint()).toEqual({ room: "coliseum", table: 3, round: 2 });
  });

  it("Continue deep-links to the exact seat + round", () => {
    writeFoxCheckpoint({ room: "hightable", table: 1, round: 0 });
    expect(foxResumeHref()).toBe("/app/foxpit/room/hightable?table=1&round=0");
  });

  it("clear removes it; no checkpoint → null href (lobby falls back to the map)", () => {
    writeFoxCheckpoint({ room: "coliseum", table: 0, round: 0 });
    clearFoxCheckpoint();
    expect(readFoxCheckpoint()).toBeNull();
    expect(foxResumeHref()).toBeNull();
  });

  it("ignores a corrupt payload instead of throwing", () => {
    window.localStorage.setItem("foxpit.checkpoint.v1", "{not json");
    expect(readFoxCheckpoint()).toBeNull();
    window.localStorage.setItem("foxpit.checkpoint.v1", JSON.stringify({ room: "coliseum" }));
    expect(readFoxCheckpoint()).toBeNull();
  });
});
